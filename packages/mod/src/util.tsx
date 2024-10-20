import React, { Suspense, Component, useSyncExternalStore, useState, useLayoutEffect } from "react";
import { getLazy, getLazyByKeys, getProxyByKeys, getProxyByStrings } from "@webpack";
import { User } from "discord-types/general";
import { FluxStore } from "discord-types/stores";
import { Fiber } from "react-reconciler";
import { FunctionType } from "typings";
import { Injector } from "./patcher";

export function isNullish(item: any): item is (null | undefined) {
  return item === null || item === undefined;
}

export function isObject(item: any): item is Object {
  if (isNullish(item)) return false;
  if (typeof item === "object") return true;
  if (typeof item === "function") return true;
  return false;
}

export function proxyCache<T extends object>(factory: () => T, typeofIsObject: boolean = false, CALL_LIMIT: number = Infinity): T {
  const handlers: ProxyHandler<T> = {};

  const cFactory = cache(factory);
  cFactory.CALL_LIMIT = CALL_LIMIT;

  const cacheFactory = () => {
    if (!cFactory.hasValue()) return cFactory();
    if (cFactory() instanceof Object) return cFactory();
    // Attempt to hopefully have the results be a instance of Object
    cFactory.reset();
    return cFactory();
  }
  
  for (const key of Object.getOwnPropertyNames(Reflect) as Array<keyof typeof Reflect>) {
    const handler = Reflect[key];

    if (key === "get") {
      handlers.get = (target, prop, r) => {
        if (prop === "prototype") return (cacheFactory() as any).prototype ?? Function.prototype;
        if (prop === Symbol.for("vx.proxy.cache")) return cFactory;
        return Reflect.get(cacheFactory(), prop, r);
      }
      continue;
    }
    if (key === "ownKeys") {
      handlers.ownKeys = () => {
        const keys = Reflect.ownKeys(cacheFactory());
        if (!typeofIsObject && !keys.includes("prototype")) keys.push("prototype");
        return keys; 
      };
      continue;
    }

    // @ts-expect-error
    handlers[key] = function(target, ...args) {
      // @ts-expect-error
      return handler.apply(this, [ cacheFactory(), ...args ]);
    }
  }
  
  const proxy = new Proxy(Object.assign(typeofIsObject ? {} : function() {}, {
    [Symbol.for("vx.proxy.cache")]: cFactory
  }) as T, handlers);

  return proxy;
}
proxyCache.__get_cache__ = <T extends object>(obj: T): Cache<T> => {
  return obj[Symbol.for("vx.proxy.cache") as unknown as keyof T] as Cache<T>;
};

export function cacheComponent<P extends {}>(factory: () => React.JSXElementConstructor<P>): React.JSXElementConstructor<P> {
  const cacheFactory = cache(factory);

  return class extends Component<P> {
    component = cacheFactory();
    render() {
      return <this.component {...this.props} />;
    }
  }
}

export function lazy<T extends React.ComponentType<any>>(factory: () => Promise<T | { default: T }>): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const result = await factory();

    if (result instanceof Object && "default" in result) return result;
    return { default: result };
  });
}

export function makeLazy<P extends {}>(opts: {
  factory: () => Promise<{ default: React.ComponentType<P> } | React.ComponentType<P>>,
  fallback?: React.ComponentType<P>,
  name?: string
}): React.JSXElementConstructor<P extends {} ? any : P> {
  const Lazy = lazy(opts.factory);
  const Fallback: React.ComponentType<P> = opts.fallback ?? (() => null);

  class LazyComponent extends Component<P> {
    static displayName: string = `VX(Suspense(${"name" in opts ? opts.name : "Unknown"}))`;

    render() {
      return (
        <Suspense fallback={<Fallback {...this.props} />}>
          <Lazy {...this.props as any} />
        </Suspense>
      )
    }
  }

  return LazyComponent as any;
}

interface classNameValueTypes {
  array: Array<string | void | false | classNameValueTypes["object"]>
  object: Record<string, boolean>
};

export function className(classNames: classNameValueTypes["array"] | classNameValueTypes["object"]) {
  if (!Array.isArray(classNames)) classNames = [ classNames ];
  
  function parseString(className: string) {
    return className.split(" ").filter(Boolean).join(" ");
  }

  const flattenedString: string[] = [];
  for (const className of classNames) {
    if (!className) continue;

    if (typeof className === "string") {
      flattenedString.push(parseString(className));
      continue;
    }

    for (const key in className) {
      if (Object.prototype.hasOwnProperty.call(className, key)) {
        if (className[key]) flattenedString.push(parseString(key));
      }
    }
  }

  return Array.from(new Set(flattenedString.join(" ").split(" "))).join(" ");
}

type ClassNameType = classNameValueTypes["array"] | classNameValueTypes["object"] | string | void | false | ClassName;

export class ClassName {
  constructor(...classNames: ClassNameType[]) {
    const classes: string[] = [];

    for (const cn of classNames) {
      if (!cn) continue;
      if (cn instanceof ClassName) {
        classes.push(...cn.keys());
        continue;
      }
      classes.push(...className(Array.isArray(cn) ? cn : [ cn ]).split(" "));
    }

    this.#classes = className(classes).split(" ");

    if (this.#classes.length === 1 && this.#classes[0] === "") this.#classes = [];
  }

  #classes: string[];

  add(...classNames: ClassNameType[]) {
    const cn = new ClassName(...classNames).keys();

    this.#classes = className([ ...this.#classes, ...cn ]).split(" ");
  }
  remove(...classNames: ClassNameType[]) {
    const cn = new ClassName(...classNames).keys();

    this.#classes = this.#classes.filter((className) => !cn.includes(className));
  }
  has(className: string) {
    return this.#classes.includes(className);
  }
  
  clear() {
    this.#classes = [];
  }

  keys() {
    return this.#classes.splice(0);
  }

  toString() {
    return this.#classes.join(" ");
  }

  map<T>(callbackfn: (value: string, index: number, array: string[]) => T, thisArg?: any): T[] {
    return this.#classes.splice(0).map(callbackfn, thisArg);
  }
  forEach(callbackfn: (value: string, index: number, array: string[]) => void, thisArg?: any) {
    return this.#classes.splice(0).forEach(callbackfn, thisArg);
  }

  toJSON() {
    return this.#classes.splice(0);
  }
  [Symbol.iterator]() {
    return iteratorFrom(this.#classes);
  }
}

let hasSeen: WeakSet<any> | null = null;
export function findInTree<T extends Object>(tree: any, searchFilter: (item: any) => any, options: {
  walkable?: string[] | null,
  ignore?: string[]
} = {}): T | void {
  hasSeen ??= new WeakSet();

  const { walkable = null, ignore = [] } = options;
  
  if (!(tree instanceof Object)) return;
  
  if (hasSeen.has(tree)) return;
  if (searchFilter(tree)) return tree as T;

  hasSeen.add(tree);

  let tempReturn: any;
  if (tree instanceof Array) {
    for (const value of tree) {
      tempReturn = findInTree(value, searchFilter, { walkable, ignore });
      if (typeof tempReturn != "undefined") {
        hasSeen = null;
        return tempReturn;
      }
    }
  }
  else {
    const toWalk = walkable == null ? Object.keys(tree) : walkable;
    for (const key of toWalk) {
      const value = tree[key];

      if (typeof(value) === "undefined" || ignore.includes(key)) continue;

      tempReturn = findInTree(value, searchFilter, { walkable, ignore });
      if (typeof tempReturn !== "undefined") {
        hasSeen = null;
        return tempReturn;
      }
    }
  }

  hasSeen = null;
  return tempReturn;
}

export function findInReactTree<T extends object>(tree: any, searchFilter: (item: any) => any): T | void {
  return findInTree(tree, searchFilter, { walkable: [ "children", "props" ] });
}

let id = 0;
const idSymbol = Symbol("vx.internal-store");
export class InternalStore {
  public static stores = new Set<InternalStore>();
  public static getStore<T extends InternalStore = InternalStore>(name: string) {
    for (const store of InternalStore.stores) {
      if (InternalStore.prototype.getName.call(store) === name) return store as T;
    }
  }
  static getStoreId(store: InternalStore) {
    return store[idSymbol];
  }

  constructor() {
    this[idSymbol] = id++;
    InternalStore.stores.add(this);
  }

  public initialize(): void {};

  public [idSymbol]: number;
  public static displayName?: string;
  public displayName?: string;

  public getName() {
    if (this.displayName) return this.displayName;

    const constructor = this.constructor as typeof InternalStore;
    if (constructor.displayName) return constructor.displayName;

    return constructor.name;
  }

  #listeners = new Set<() => void>();
  
  public addChangeListener(callback: () => void) {
    this.#listeners.add(callback);
  }
  public removeChangeListener(callback: () => void) {
    this.#listeners.delete(callback);
  }

  public emit() {
    for (const listener of this.#listeners) {
      listener();
    }
  }

  public getClass(): typeof InternalStore {
    return this.constructor as any;
  }
  public getId() {
    return InternalStore.getStoreId(this);
  }
}

const copyCommandSupported = document.queryCommandEnabled("copy") || document.queryCommandSupported("copy");
export const clipboard = {
  SUPPORTS_COPY: typeof window.VXNative === "object" || typeof navigator.clipboard === "object" || copyCommandSupported,
  async readText() {
    if (window.VXNative) {
      return Promise.resolve(window.VXNative.clipboard.read());
    }
    if (navigator.clipboard) {
      try {
        return navigator.clipboard.readText();
      } catch (error) {
        // Do nothing
      }
    }
    
    throw new Error("Clipboard action isn't supported!");
  },
  async copy(text: string) {
    if (window.VXNative) {
      window.VXNative.clipboard.copy(text);
      return true;
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // Do nothing
      }
    }
    if (copyCommandSupported && document.body) {
      const range = document.createRange();
      const selection = window.getSelection();
      const textarea = document.createElement("textarea");

      textarea.value = text;
      textarea.contentEditable = "true";
      textarea.style.visibility = "none";

      document.body.appendChild(textarea);

      range.selectNodeContents(textarea);

      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      textarea.focus();
      textarea.setSelectionRange(0, text.length);

      document.execCommand("copy");

      document.body.removeChild(textarea);

      return true;
    }

    throw new Error("Clipboard action isn't supported!");
  }
};

export const base64 = {
  decode(base64: string) {
    return new TextDecoder().decode(Uint8Array.from(atob(base64), (m) => m.codePointAt(0)!));
  },
  encode(text: string) {
    return btoa(String.fromCodePoint(...new TextEncoder().encode(text)));
  }
};

export function getComponentType<P>(component: string | React.ComponentType<P> | React.MemoExoticComponent<React.ComponentType<P>> | React.ForwardRefExoticComponent<P>): React.ComponentType<P> | string {
  if (component instanceof Object && "$$typeof" in component) {
    if (component.$$typeof === Symbol.for("react.memo")) return getComponentType<P>((component as any).type);
    if (component.$$typeof === Symbol.for("react.forward_ref")) return getComponentType<P>((component as any).render);
  }

  return component as React.ComponentType<P> | string;
}

export function escapeRegex(text: string, flags?: string): RegExp {
  text = text.replace(/[\.\[\]\(\)\\\$\^\|\?\*\+]/g, "\\$&");
  return new RegExp(text, flags);
}

export function getRandomItem<T extends any[]>(array: T): T[number] {
  return array.at(Math.floor(Math.random() * array.length))!;
}

// Not a secure hash
export function hashCode(str: string) {
  let hash = 0;

  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }

  return hash;
}

const defaultAvatarModule = getProxyByKeys<{
  DEFAULT_AVATARS: string[]
}>([ "DEFAULT_AVATARS" ]);

export function getDefaultAvatar(id?: string) {
  if (typeof id === "string") {
    let number = Number(id);
    if (isNaN(number)) number = hashCode(id);

    return defaultAvatarModule.DEFAULT_AVATARS[Math.abs(number % defaultAvatarModule.DEFAULT_AVATARS.length)];
  }

  return getRandomItem(defaultAvatarModule.DEFAULT_AVATARS);
}

const patchedReactHooks = {
  useMemo(factory: () => any) {
    return factory();
  },
  useState(initial: any) {
    if (typeof initial === "function") return [ initial(), () => {} ];
    return [ initial, () => {} ];
  },
  useReducer(initial: any) {
    if (typeof initial === "function") return [ initial(), () => {} ];
    return [ initial, () => {} ];
  },
  useEffect() {},
  useLayoutEffect() {},
  useRef(value: any = null) {
    return { current: value };
  },
  useCallback(callback: Function) {
    return callback;
  },
  useContext(context: any) {
    return context._currentValue;
  }
};
export function wrapInHooks<P>(functionComponent: React.FunctionComponent<P>, customPatches: Partial<typeof patchedReactHooks>): React.FunctionComponent<P> {
  return (props?: P, context?: any) => {
    const reactDispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;

    const clone = { ...reactDispatcher };

    Object.assign(reactDispatcher, patchedReactHooks, customPatches);

    try {
      return functionComponent(props ?? {} as P, context);
    } 
    catch (error) {
      throw error;
    }
    finally {
      Object.assign(reactDispatcher, clone);
    }
  };
}

export function showFilePicker(callback: (file: File | null) => void, accepts: string = "*") {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accepts;
  input.multiple = false;

  input.showPicker();

  input.addEventListener("change", () => {
    input.remove();

    const [ file ] = input.files!;
    
    callback(file ?? null);
  });
};

export function download(filename: string, ...parts: BlobPart[]) {
  const blob = new Blob(parts, { type: "application/octet-stream" });
  const blobURL = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = blobURL;
  anchor.download = filename;
  document.body.append(anchor);

  anchor.click();

  anchor.remove();
  URL.revokeObjectURL(blobURL);
};

export function downloadFile(file: File) {
  download(file.name, file.slice(0, file.size, file.type));
}

export function createNullObject<T extends Record<PropertyKey, any> = Record<PropertyKey, any>>(properties?: T, name?: string): T {
  let descriptors: { [key: PropertyKey]: PropertyDescriptor } = {};
  if (properties) {
    descriptors = Object.getOwnPropertyDescriptors(properties);
  }

  if (typeof name === "string") {
    descriptors[Symbol.toStringTag] = { value: name };
  }

  return Object.create(null, descriptors);
}

// 'Iterator.from' polyfill like thing
export function iteratorFrom<T>(iterator: Iterable<T>): IterableIterator<T> {
  if (typeof (window as any).Iterator === "function") {
    return (window as any).Iterator.from(iterator);
  }

  const generator = iterator[Symbol.iterator]();
  
  const data = {};
  Object.defineProperty(data, "next", {
    enumerable: false,
    writable: true,
    configurable: true,
    value: generator.next.bind(generator)
  });
  Object.defineProperty(data, Symbol.toStringTag, {
    enumerable: false,
    writable: false,
    configurable: true,
    value: "Array Iterator"
  });

  const proto = {};
  Object.defineProperty(proto, Symbol.iterator, {
    enumerable: false,
    writable: true,
    configurable: true,
    value: function*() {
      let result: IteratorResult<T, any>;
      while ((result = generator.next(), !result.done)) yield result.value;
    }
  });

  Object.setPrototypeOf(data, proto);

  return Object.setPrototypeOf({}, data);
}

const VXNodeListPrivate = new WeakMap<VXNodeList<Node>, Node[]>();
export class VXNodeList<T extends Node> {
  static fromNodeList(nodeList: NodeList) {
    return new this(Array.from(nodeList));
  }
  
  constructor(nodes: T[] = [ ]) {
    const nodesList = Array.from(nodes).filter((node) => node instanceof Node);
    VXNodeListPrivate.set(this, nodesList);

    let counter = 0;
    for (const node of nodesList) {
      this[counter++] = node;
    }
  }

  [key: number]: T;

  querySelector<E extends T>(selectors: string): E | null {
    for (const node of this) {
      if (!(node instanceof Element)) continue;
      if (node.matches(selectors)) return node as unknown as E;
    }

    return null;
  }
  querySelectorAll(selectors: string): VXNodeList<T> {
    const matches = [];

    for (const node of this) {
      if (!(node instanceof Element)) continue;
      if (node.matches(selectors)) matches.push(node);
    }

    return new VXNodeList(matches);
  }
  getElementById(id: string): T | null {
    for (const node of this) {
      if (!(node instanceof Element)) continue;
      if (node.id === id) return node;
    }

    return null;
  }

  includes(node: T | null): boolean {
    if (node === null) return false;
    return VXNodeListPrivate.get(this)!.includes(node);
  }

  get length() { return VXNodeListPrivate.get(this)!.length; }

  entries() {
    const gen = this.values();
    let result: IteratorResult<T, void>;
    let counter = 0;
    const entries: [ number, T ][] = [];

    while ((result = gen.next(), !result.done)) {
      entries.push([ counter++, result.value ]);
    }

    return iteratorFrom(entries);
  }

  keys() {
    const gen = this.values();
    let result: IteratorResult<T, void>;
    let counter = 0;
    const keys: number[] = [];

    while ((result = gen.next(), !result.done)) {
      keys.push(counter++);
    }

    return iteratorFrom(keys);
  }

  values(): IterableIterator<T> {
    return iteratorFrom(VXNodeListPrivate.get(this)! as T[]); 
  }

  item(index: number): T | null {
    return VXNodeListPrivate.get(this)!.at(index) as T | undefined ?? null;
  }

  forEach(callbackfn: (value: T, key: number, parent: VXNodeList<T>) => void, thisArg: any = this) {
    for (const [ key, node ] of this.entries()) {
      callbackfn.apply(thisArg, [ node, key, this ]);
    }
  }

  [Symbol.iterator]() {
    return iteratorFrom(VXNodeListPrivate.get(this)! as T[]); 
  }
};

export function getParents(element: Element | null): VXNodeList<Element> {
  if (!element) return new VXNodeList();

  const parents = [];

  while (element = element.parentElement) {
    parents.push(element);
  }
  
  return new VXNodeList(parents);
}

export function createAbort(): readonly [ abort: (reason?: any) => void, getSignal: () => AbortSignal ] {
  let controller = new AbortController();

  function abort(reason?: any) {
    controller.abort(reason);

    controller = new AbortController();
  }

  return [ abort, () => controller.signal ];
}

export function isInvalidSyntax(code: string): false | SyntaxError {
  try {
    compileFunction(code, [ ]);
    return false;
  } 
  catch (error) {
    // IDK what other kind of errors i can get but better safe than sry
    if (error instanceof SyntaxError) return error;
    return false;
  }
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

type NotFunction<T> = Exclude<T, Function>
export function memorize<T extends { [key in string]: () => any }>(instance: T & NotFunction<T>): { [key in keyof T]: ReturnType<T[key]> } {
  const clone = {} as { [key in keyof T]: ReturnType<T[key]> };

  for (const key in instance) {
    if (Object.prototype.hasOwnProperty.call(instance, key)) {
      const element = instance[key as keyof T];
      
      Object.defineProperty(clone, key, {
        get: cache(element)
      });
    }
  }

  return clone;
}

export function getDiscordTag(user: User) {
  const isPomelo = (user as any).isPomelo() || (user.discriminator === "0000");
  return [
    // isPomelo ? "@" : false,
    (user as any).globalName || user.username,
    !isPomelo ? `#${user.discriminator}` : false
  ].filter((m) => m).join("");
}

export function generateFaviconURL(website: string, size = 64): string {
  const url = new URL("https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL");
  
  url.searchParams.set("url", website);
  url.searchParams.set("size", String(size));

  return url.href;
}

export function toArray<T>(itemOrItems: T | T[]): T[] {
  return Array.isArray(itemOrItems) ? itemOrItems : [ itemOrItems ];
}

export function createFluxComponent<P = {}, S = {}, SS = {}, T = any>(stores: (FluxStore | InternalStore)[] | FluxStore | InternalStore, factory: () => T) {
  const $stores = toArray(stores);

  class FluxComponent extends React.Component<P, S, SS> {
    constructor(props: P) {
      super(props);

      this.forceUpdateFluxState = this.forceUpdateFluxState.bind(this);
    }

    public readonly fluxState: T = factory();
    
    protected forceUpdateFluxState(callback?: () => void) {
      (this as any).fluxState = factory();
      this.forceUpdate(callback);
    }

    public componentDidMount(): void {
      for (const store of $stores) store.addChangeListener(this.forceUpdateFluxState);
    }
    public componentWillUnmount(): void {
      for (const store of $stores) store.removeChangeListener(this.forceUpdateFluxState);
    }
  }

  return FluxComponent;
}

export let reactExists = false;
getLazyByKeys([ "memo", "createElement" ]).then(() => { reactExists = true; });

type Accessor<T> = (forceNoUseHook?: boolean) => T;
type SetterArg<T> = ((prev: T) => T) | T;
type Setter<T> = (value: SetterArg<T>) => T;
type OnChange<T> = (callback: (value: T) => void) => void;
type State<T> = Readonly<[ accessor: Accessor<T>, setter: Setter<T>, addChangeListener: OnChange<T> ]>;

// SolidJS like thing
export function createState<T>(initialState: T): State<T> {
  let currentState = initialState;
  const listeners = new Set<() => void>();

  function accessor(forceNoUseHook = false) {
    if (!reactExists) return currentState;
    
    const dispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;
    
    if (forceNoUseHook || !String(dispatcher.useSyncExternalStore).includes("349")) {
      return currentState;
    }    

    return useSyncExternalStore((onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange)
    }, () => currentState);
  }

  function setter(value: SetterArg<T>) {
    if (typeof value === "function") value = (value as (pref?: T) => T)(currentState);
    currentState = value;
    
    for (const listener of listeners) listener();

    return currentState;
  }
  
  function addChangeListener(callback: (state: T) => void): () => void {
    function callbackWrapper() {
      try {
        callback(currentState);
      } 
      catch (error) {}
    }

    listeners.add(callbackWrapper);
    return () => void listeners.delete(callbackWrapper);
  }

  const state: State<T> = [
    accessor,
    setter,
    addChangeListener
  ];

  return state;
}

export function destructuredPromise<T extends any = void>(): PromiseResolvers<T> {
  if (Promise.withResolvers) return Promise.withResolvers();

  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason: any) => void;
  const promise = new Promise<T>(($resolve, $reject) => {
    resolve = $resolve;
    reject = $reject;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

// [Symbol.hasInstance] overrides the native instanceof so this calls it
export function hasInstance(constructor: any, instance: any) {
  return Object[Symbol.hasInstance].call(constructor, instance);
}

interface TimeOptions {
  includeHours?: boolean,
  forceShowHours?: boolean,
  forceShowMinutes?: boolean,
  addExtraDegits?: boolean
}

export function simpleFormatTime(time: string | number | Date, options: TimeOptions = {}) {
  const { includeHours = false, forceShowHours = true, forceShowMinutes = true, addExtraDegits = false } = options;

  const seconds = Math.floor(new Date(time).getTime() / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const shouldShowHours = includeHours && Boolean(hours || forceShowHours);
  const shouldShowMinutes = shouldShowHours || forceShowMinutes || Boolean(minutes || addExtraDegits);

  function pad(time: number, addExtraDegits: boolean) {
    if (addExtraDegits) return String(time).padStart(2, "0");
    return String(time);
  }

  return `${shouldShowHours ? `${hours}:` : ""}${shouldShowMinutes ? `${pad(minutes % 60, shouldShowHours || addExtraDegits)}:` : ""}${pad(seconds % 60, shouldShowMinutes || addExtraDegits)}`;
}

export function getInternalInstance(node?: Node): Fiber | null {
  return node?.__reactFiber$ || null;
}
export function getOwnerInstance<P = {}, S = {}, SS = any>(instance: Fiber | Node | null): Component<P, S, SS> | null {
  if (instance instanceof Node) instance = getInternalInstance(instance);

  if (!instance) return null;

  const fiber = findInTree<Fiber>(instance, (item) => item.stateNode instanceof Component, { walkable: [ "return" ] });
  if (!fiber) return null;

  return fiber.stateNode;
}

export function setRefValue<T>(ref: React.Ref<T> | void, value: T) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) (ref as React.MutableRefObject<T>).current = value;
}

export function compileFunction<T extends FunctionType>(code: string, args: string[] = [ ]): T {
  return new Function(...args, code) as T;
}

export function getCSSVarColor(variable: `--${string}`, node: Element = document.body): string {
  const div = document.createElement("div");
  div.style.color = `var(${variable})`;
  div.style.display = "none !important";
  
  node.append(div);
  const color = getComputedStyle(div).color;
  div.remove();
  
  return color;
}

export const focusStore = new class FocusStore extends InternalStore {
  constructor() {
    super();
    
    window.addEventListener("focus", () => this.emit());
    window.addEventListener("blur", () => this.emit());
  }

  public get hasFocus() { return document.hasFocus(); }
  public useFocus() {
    const [ hasFocus, setFocus ] = useState(() => document.hasFocus());

    useLayoutEffect(() => {
      function listener() {
        setFocus(document.hasFocus());
      }
      
      window.addEventListener("focus", listener);
      window.addEventListener("blur", listener)
      
      return () => {
        window.removeEventListener("focus", listener);
        window.removeEventListener("blur", listener);
      }
    }, [ ]);

    return hasFocus;
  }
}

const AVATARS: Record<string, string> = {
  vx: "https://raw.githubusercontent.com/doggybootsy/vx/main/assets/avatar.png",
  spotify: "/assets/6daf7db5db0d4a895afa.svg"
}

getLazy<{
  default: {
    getUserAvatarURL(user: any): string
  }
}>(m => m.default?.getUserAvatarURL).then((module) => {
  new Injector().after(module.default, "getUserAvatarURL", (that, args, res) => {    
    if (typeof args[0] === "object" && args[0].avatar in AVATARS) {
      return Injector.return(AVATARS[args[0].avatar]);
    }
  });
});

const createMessage = getProxyByStrings([ "createMessage: author cannot be undefined" ]);

export function sendVXSystemMessage(channelId: string, content: string) {
  const message = (createMessage as any)({
    channelId: channelId,
    type: 0,
    content: content,
    flags: 64,
    author: {
      id: "vx",
      username: "VX",
      discriminator: "0000",
      avatar: "vx",
      bot: true
    }
  });

  window.VX.webpack.common.MessageActions.receiveMessage(channelId, {
    ...message,
    state: "SENT",
    channel_id: channelId
  }, !0)
}

export const suffixNumber = (v: number) =>
    v >= 1e9 ? (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B' :
        v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' :
            v >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' :
                v.toString(); // We do NOT need Trillion

const $cache = cache;
export { $cache as cache };

const domParser = new DOMParser();

export function convertSvgToURL(content: string, color?: React.CSSProperties["color"]) {
  const parsed = domParser.parseFromString(content, "image/svg+xml");

  if (!(parsed.documentElement instanceof SVGElement)) return;

  if (!parsed.documentElement.hasAttribute("xmlns")) {
    parsed.documentElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  if (typeof color === "string") {
    parsed.documentElement.style.color = color;
  }

  return URL.createObjectURL(new Blob([ parsed.documentElement.outerHTML ], { type: "image/svg+xml" }));
}

export async function callSafely(fn: () => any, onError: (err: any) => void = () => {}): Promise<void> {
  try {
    const result = fn();
    if (result instanceof Promise) await result;
  } 
  catch (error) {
    onError(error);
  }
}

export interface Persistence<T> {
  get(): T | undefined,
  set(value: T): void,
  clear(): void,
  has(): boolean,
  ensure(value: T): T
}

const persistenceObjects: Record<string, Persistence<any>> = {}

export function createPersistence<T>(key: string): Persistence<T> {
  key = `VX(${key})`;

  if (key in persistenceObjects) return persistenceObjects[key];
  
  return persistenceObjects[key] = createNullObject({
    get() {
      const data = window.sessionStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data);
    },
    set(value: any) {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    },
    clear() {
      window.sessionStorage.removeItem(key);
    },
    has() {
      for (let index = 0; index < window.sessionStorage.length; index++) {
        if (window.sessionStorage.key(index) === key) return true;
      }

      return false;
    },
    ensure(value) {
      if (!this.has()) this.set(value);
      return this.get()!;
    }
  }, key);
}

export function forceUpdateApp(): Promise<void> {
  if (!__self__.Root.instance) return Promise.resolve();
  return __self__.Root.instance.forceRerender();
}

export function getReleaseChannel(): DiscordReleases {
  if (location.hostname.startsWith("ptb.")) return "ptb";
  if (location.hostname.startsWith("canary.")) return "canary";
  return "stable";
}