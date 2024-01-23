import { internalDataStore } from "../api/storage";
import { Developer } from "../constants";
import { PlainTextPatchType, addPlainTextPatch, getLazyByKeys } from "@webpack";
import { CreatedSetting } from "./settings";
import { FluxDispatcher } from "@webpack/common";

export interface PluginType {
  authors: Developer[],
  patches?: PlainTextPatchType | PlainTextPatchType[],
  settings?: Record<string, CreatedSetting<any>> | React.ComponentType,
  requiresRestart?: boolean,
  start?(): void,
  stop?(): void,
  fluxEvents?: Record<string, (data: Record<PropertyKey, any>) => void>,
  styler?: ManagedCSS
};

export type AnyPluginType = PluginType & Record<string, any>;

const dispatcher = getLazyByKeys([ "subscribe", "dispatch" ]);

export class Plugin<T extends AnyPluginType = AnyPluginType> {
  constructor(public readonly exports: T) {    
    const match = new Error().stack!.match(/plugins\/(.+?)\//)!;
    this.id = match[1];

    this.requiresRestart = exports.requiresRestart ?? true;
    this.originalEnabledState = this.isEnabled();

    dispatcher.then(() => {
      if (!exports.fluxEvents) return;

      for (const eventName in exports.fluxEvents) {
        if (!Object.prototype.hasOwnProperty.call(exports.fluxEvents, eventName)) continue;

        const handler = exports.fluxEvents[eventName];
        FluxDispatcher.subscribe(eventName, (event: any) => {
          if (!this.isEnabled()) return;

          try {
            handler(event);
          } 
          catch (error) {
            console.warn(`[VX~Plugins~Flux]: Plugin '${this.id}' errored when running Flux event '${eventName}'`, { error, handler });
          }
        });
      }
    });
  };

  type = <const>"internal";

  id: string;

  public readonly styler?: ManagedCSS;

  public readonly originalEnabledState: boolean;
  public readonly requiresRestart: boolean;

  public getActiveState() {
    if (this.requiresRestart) return this.originalEnabledState;
    return this.isEnabled();
  };

  public isEnabled() {
    internalDataStore.ensure("enabled-plugins", { });
  
    const enabled = internalDataStore.get("enabled-plugins")!;
    
    return enabled[this.id] === true;
  };
  public enable() {
    if (this.isEnabled()) return false;

    const enabled = structuredClone(internalDataStore.get("enabled-plugins")!);

    enabled[this.id] = true;

    internalDataStore.set("enabled-plugins", enabled);

    if (!this.requiresRestart) {
      if (typeof this.exports.start === "function") this.exports.start();
      if (this.styler) this.styler.addStyle();
    }

    return true;
  };
  public disable() {
    if (!this.isEnabled()) return false;

    const enabled = structuredClone(internalDataStore.get("enabled-plugins")!);

    enabled[this.id] = false;

    internalDataStore.set("enabled-plugins", enabled);

    if (!this.requiresRestart) {
      if (typeof this.exports.stop === "function") this.exports.stop();
      if (this.styler) this.styler.removeStyle();
    }
    
    return true;
  };
  public toggle() {
    if (this.isEnabled()) {
      this.disable();
      return false;
    };

    this.enable();
    return true;
  };
};

export const plugins: Record<string, Plugin> = {};

export function getPlugin(id: string) {
  for (const plugin of Object.values(plugins)) {
    if (id === plugin.id) return plugin;
  }

  return null;
};

export function definePlugin<T extends AnyPluginType>(exports: T): T {
  const plugin = new Plugin(exports);

  const isEnabled = plugin.isEnabled();

  plugins[plugin.id] = plugin;

  if (exports.patches) {
    if (!Array.isArray(exports.patches)) exports.patches = [ exports.patches ];
    
    for (const patch of exports.patches) {
      const self = `window.VX._self.getPlugin(${JSON.stringify(plugin.id)})`;

      patch._self = {
        plugin: self,
        self: `${self}.exports`,
        enabled: `${self}.getActiveState()`
      };

      if (typeof patch.identifier !== "string") patch.identifier = plugin.id;
      else patch.identifier = `${plugin.id}(${patch.identifier})`;
    };
    // if 'requiresRestart' is false then we can add them, because the plugin will have something incase
    if (isEnabled || !plugin.requiresRestart) addPlainTextPatch(...exports.patches);
  };

  if (isEnabled) {
    if (typeof exports.start === "function") exports.start();
    if (exports.styler) exports.styler.addStyle();
  }

  return exports;
};

// For use inside of plugins
export function isPluginEnabled(nameOrId: string) {
  const plugin = getPlugin(nameOrId);
  if (plugin) return plugin.getActiveState();
  return false;
};

require("@plugins");