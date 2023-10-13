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

type PushFunction = (chunk: Webpack.ModuleWithoutEffect | Webpack.ModuleWithEffect) => any;
function createPush<T extends boolean>(getter: T, push: PushFunction): T extends true ? () => PushFunction : PushFunction {
  function handlePush(this: any, chunk: Webpack.ModuleWithoutEffect | Webpack.ModuleWithEffect) {
    const [, modules] = chunk;

    for (const id in modules) {
      if (Object.prototype.hasOwnProperty.call(modules, id)) {
        const originalModule = modules[id];

        let stringedModule = modules[id].toString().replace(/[\n]/g, "");
        const identifiers = new Set<string>();

        for (const patch of plainTextPatches) {
          if (typeof patch.match === "string" ? !stringedModule.includes(patch.match) : !patch.match.test(stringedModule)) continue;

          if (patch.identifier) identifiers.add(patch.identifier);

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

        stringedModule = `(()=>\n/*\n Module Id: ${id}${identifiers.size ? `\n Known string patch identifiers '${Array.from(identifiers).join("', ")}'` : ""}\n*/\nfunction(){\n\t(${stringedModule}).apply(this, arguments);\n\twindow.VX.webpack._onWebpackModule(arguments[0]);\n}\n)()\n//# sourceURL=vx://VX/webpack-modules/${id}`;

        const moduleFN = (0,eval)(stringedModule);

        modules[id] = moduleFN;
        
        // @ts-expect-error expose original
        modules[id].__original = originalModule;
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