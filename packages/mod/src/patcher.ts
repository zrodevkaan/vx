import { Component, isValidElement } from "react";
import { FunctionType, ThisParameterType, Parameters, ReturnType } from "typings";

type KeysMatching<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];

class InjectorReturn<T = any> {
  constructor(public readonly value: T) {}
}

type AfterCallback<F extends FunctionType> = (that: ThisParameterType<F>, args: Parameters<F>, result: ReturnType<F>) => void | InjectorReturn<ReturnType<F>>;
type InsteadCallback<F extends FunctionType> = (that: ThisParameterType<F>, args: Parameters<F>, original: F) => ReturnType<F>;
type BeforeCallback<F extends FunctionType> = (that: ThisParameterType<F>, args: Parameters<F>) => void;
// 'component' argument only exist's if the element type is a React.Component
type ReactElementCallback<P extends {}> = (props: P, result: React.ReactNode, component?: React.Component<P>) => void | InjectorReturn<React.ReactNode>;

type UndoFunction = () => void;

interface Hook<F extends FunctionType> {
  after: Set<AfterCallback<F>>,
  instead: Set<InsteadCallback<F>>,
  before: Set<BeforeCallback<F>>,
  original: F
};

function apply<T extends FunctionType>(fn: T, that: ThisParameterType<T>, args: Parameters<T>): ReturnType<T> {
  return Function.prototype.apply.call(fn, that, args);
}

const HOOK_SYMBOL = Symbol.for("vx.patcher.hook");
function hookFunction<M extends Record<PropertyKey, any>, K extends KeysMatching<M, FunctionType>, F extends M[K]>(module: M, key: K): Hook<F> {
  const fn = module[key];

  if (HOOK_SYMBOL in fn) return fn[HOOK_SYMBOL];

  const hook: Hook<F> = {
    after: new Set(),
    instead: new Set(),
    before: new Set(),
    original: fn
  };

  const VXPatcher = new Proxy(fn, {
    apply(target, that, argArray) {
      const args = Array.from(argArray) as Parameters<F>;
  
      for (const before of hook.before) before(that, args)
  
      let result: ReturnType<F>;
      if (!hook.instead.size) {
        result = apply(fn, that, args);
      }
      else {
        const insteadHooks = Array.from(hook.instead);
        const instead = insteadHooks.at(0)!;
        let depth = 1;

        const goDeeper: M[K] = new Proxy(target, {
          apply(target, thisArg, argArray) {
            const hook = insteadHooks.at(depth++);
            if (hook) return hook(thisArg, argArray as Parameters<F>, goDeeper as F);
            return apply(target, thisArg, argArray as Parameters<F>);
          }
        });
  
        result = instead(that, args, goDeeper as F);
      }
  
      for (const after of hook.after) {
        const res = after(that, args, result);
        if (res instanceof InjectorReturn) result = res.value;
      }
  
      return result;
    }
  });

  VXPatcher[HOOK_SYMBOL] = hook;
  module[key] = VXPatcher;

  return hook;
};

const patches = new WeakMap<Injector, Set<UndoFunction>>();

const map = new WeakMap<any, Set<ReactElementCallback<any>>>();

function hookElement<P extends {} = {}>(node: React.ReactElement<P, React.JSXElementConstructor<P>>) {
  if (!isValidElement(node)) throw new TypeError(`Argument 'node' must be type a react element!`);
  if (map.has(node.type)) return map.get(node.type)!;
  
  const callbacks = new Set<ReactElementCallback<P>>();

  const { type } = node as { type: any };

  node.type = new Proxy(type, {
    construct(target, argArray, newTarget) {
      const self = Reflect.construct(target, argArray, newTarget);
      const { render } = self;

      self.render = function() {
        let result = render();

        for (const callback of callbacks) {
          const res = callback(this.props, result, this);
          if (res instanceof InjectorReturn) result = res.value;
        }

        return result;
      }

      return self;
    },
    apply(target, thisArg, argArray) {
      let result = Reflect.apply(target, thisArg, argArray);

      for (const callback of callbacks) {
        // @ts-expect-error
        const res = callback(argArray[0], result);
        if (res instanceof InjectorReturn) result = res.value;
      }

      return result;
    }
  });

  map.set(type, callbacks);
  map.set(node.type, callbacks);

  return callbacks;
}

export class Injector {
  public static return<T extends any>(value: T) {
    return new InjectorReturn(value);
  }
  public static getOriginal<T extends FunctionType>(hooked: T): T {
    if (HOOK_SYMBOL in hooked) (hooked[HOOK_SYMBOL] as Hook<T>).original;
    return hooked;
  }

  public static patchElement<P extends {} = {}>(node: React.ReactElement<P, React.JSXElementConstructor<P>>, callback: ReactElementCallback<P>, once: boolean = true) {
    const hooked = hookElement(node);

    hooked.add(function newCallback(props, res, component) {
      const result =  callback(props, res, component);
      if (once) hooked.delete(newCallback);
      return result;
    });
  }

  // Copy the 3 static methods to the prototype
  public return<T extends any>(value: T) {
    return Injector.return(value);
  }
  public getOriginal<T extends FunctionType>(hooked: T): T {
    return Injector.getOriginal(hooked);
  }
  public patchElement<P extends {} = {}>(node: React.ReactElement<P, React.JSXElementConstructor<P>>, callback: ReactElementCallback<P>, once: boolean = true) {
    Injector.patchElement(node, callback, once);
  }

  // Runs callback after the original function was called
  public after<M extends Record<PropertyKey, any>, K extends KeysMatching<M, FunctionType>, F extends M[K]>(module: M, key: K, callback: AfterCallback<F>) {
    const hook = hookFunction(module, key);

    hook.after.add(callback);

    if (!patches.has(this)) patches.set(this, new Set<() => void>());
    const $patches = patches.get(this)!;
  
    function undo() {
      $patches.delete(undo);
      hook.after.delete(callback);
    }

    $patches.add(undo);
    return undo;
  }
  // Runs the callback instead of the original function
  public instead<M extends Record<PropertyKey, any>, K extends KeysMatching<M, FunctionType>, F extends M[K]>(module: M, key: K, callback: InsteadCallback<F>) {
    const hook = hookFunction(module, key);

    hook.instead.add(callback);

    if (!patches.has(this)) patches.set(this, new Set<() => void>());
    const $patches = patches.get(this)!;
  
    function undo() {
      $patches.delete(undo);
      hook.instead.delete(callback);
    }

    $patches.add(undo);
    return undo;
  }
  // Runs callback before the original function was called
  public before<M extends Record<PropertyKey, any>, K extends KeysMatching<M, FunctionType>, F extends M[K]>(module: M, key: K, callback: BeforeCallback<F>) {
    const hook = hookFunction(module, key);

    hook.before.add(callback);

    if (!patches.has(this)) patches.set(this, new Set<() => void>());
    const $patches = patches.get(this)!;
  
    function undo() {
      $patches.delete(undo);
      hook.before.delete(callback);
    }

    $patches.add(undo);
    return undo;
  }
  // Undos all patches
  public unpatchAll() {
    if (!patches.has(this)) return;
    for (const undo of patches.get(this)!) undo();
  }
}
