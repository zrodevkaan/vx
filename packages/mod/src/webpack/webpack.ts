import { plainTextPatches } from "./patches";

export const webpackAppChunk = window.webpackChunkdiscord_app ??= [];

export let webpackRequire: Webpack.Require | void;

webpackAppChunk.push([
  [ Symbol.for("VX") ],
  { },
  (wpr) => {
    webpackRequire = wpr;

    wpr.d = (target, exports) => {
      for (const key in exports) {
        if (!Reflect.has(exports, key)) continue;
  
        Object.defineProperty(target, key, {
          get() { return exports[key]() },
          set(v) { exports[key] = () => v; },
          enumerable: true,
          configurable: true
        });
      }
    };
  }
]);

export const listeners = new Set<(module: Webpack.Module) => void>();

const getPrefix = /^(.*?)\(/;
// Functions like ones from objects ({ a() {} }) will throw so we replace 'a' with 'function'
function toStringFunction(fn: Function) {
  const stringed = fn.toString();
  const match = stringed.match(getPrefix);

  if (!match) return stringed;

  if (match[1].includes("=>") && !/^[\['"]/.test(match[1])) {
    return stringed;
  };

  if (!match[1]) return stringed;

  return stringed.replace(match[1], "function");
};

type PushFunction = (chunk: Webpack.ModuleWithoutEffect | Webpack.ModuleWithEffect) => any;
function createPush<T extends boolean>(getter: T, push: PushFunction): T extends true ? () => PushFunction : PushFunction {
  function handlePush(this: any, chunk: Webpack.ModuleWithoutEffect | Webpack.ModuleWithEffect) {
    const [, modules] = chunk;

    for (const id in modules) {
      if (Object.prototype.hasOwnProperty.call(modules, id)) {
        const originalModule = modules[id];

        // @ts-expect-error Duplicates happen idfk
        if (originalModule.__VXOriginal) continue;

        let stringedModule = toStringFunction(originalModule).replace(/[\n]/g, "");
        const identifiers = new Set<string>();

        for (const patch of plainTextPatches) {
          if (typeof patch.match === "string" ? !stringedModule.includes(patch.match) : !patch.match.test(stringedModule)) continue;

          if (patch.identifier) identifiers.add(patch.identifier);

          if (!Array.isArray(patch.replacements)) patch.replacements = [ patch.replacements ];

          for (const replace of patch.replacements) {
            if (replace.predicate && !replace.predicate()) continue;
            
            if (typeof replace.replace === "string") {
              let replacer = replace.replace
                .replace(/\$react/g, "window.VX.React");
              if (typeof patch._self === "string") replacer = replacer.replace(/\$self/g, patch._self);

              stringedModule = stringedModule.replace(replace.find as any, replacer);
            }
            else stringedModule = stringedModule.replace(replace.find as any, replace.replace as any);
          };
        };
        
        stringedModule = `(()=>\n/*\n Module Id: ${id}${identifiers.size ? `\n Known string patch identifiers '${Array.from(identifiers).join("', '")}'` : ""}\n*/\nfunction(){\n\t(${stringedModule}).apply(this, arguments);\n\twindow.VX._self._onWebpackModule.apply(this, arguments);\n}\n)()\n//# sourceURL=vx://VX/webpack-modules/${id}`;

        const moduleFN = (0, eval)(stringedModule);
        moduleFN.__VXOriginal = originalModule;

        modules[id] = moduleFN;
      };
    };

    return push.call(this, chunk);
  };

  if (getter) return () => handlePush;
  // @ts-expect-error TS should have better stuff for this :(
  return handlePush;
};

Object.defineProperty(webpackAppChunk, "push", {
  configurable: true,
  get: createPush(true, webpackAppChunk.push),
  set: (val) => {
    Object.defineProperty(webpackAppChunk, "push", {
      value: createPush(false, val),
      configurable: true,
      writable: true
    });
  }
});