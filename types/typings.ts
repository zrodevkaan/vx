// Function Typings
export type ClassType = new (...args: any) => any;
export type FunctionType = (this: any, ...args: any) => any;
export type AnyFunctionType = ClassType | FunctionType;

export type ClassParameters<T extends ClassType> = T extends new (...args: infer P) => any ? P : never;
export type FunctionParameters<T extends FunctionType> = T extends (this: any, ...args: infer P) => any ? P : never;
export type Parameters<T extends ClassType | FunctionType> = T extends ClassType ? ClassParameters<T> : T extends FunctionType ? FunctionParameters<T> : never;

export type ClassReturnType<T extends ClassType> = T extends new (...args: any) => infer P ? P : never;
export type FunctionReturnType<T extends FunctionType> = T extends (this: any, ...args: any) => infer P ? P : never;
export type ReturnType<T extends ClassType | FunctionType> = T extends ClassType ? ClassReturnType<T> : T extends FunctionType ? FunctionReturnType<T> : never;

export type ThisParameterType<T extends FunctionType> = T extends (this: infer P, ...args: any) => any ? P : never;