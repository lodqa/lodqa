
interface PromiseExecutor<T> {
    (resolve: PromiseResolveFunction<T>, reject: PromiseRejectFunction): void;
}

interface PromiseRejectFunction {
    (reason: Error): void;
    (reason: any): void;
}
interface PromiseResolveFunction<T> {
    (value: T): void;
}

interface PromiseErrorCallback {
    (reason: Error): any;
    (reason: any): any;
}

interface PromiseCapability<T> {
    promise: Promise<T>;
    resolve: PromiseResolveFunction<T>;
    reject: PromiseRejectFunction;
}

interface PromiseReaction {
    capability: PromiseCapability<any>;
    handler: Function;
}

interface PromiseTask {
    executor: Function;
    args: any[];
}

interface Thenable<T> {
    then<U>(onFulfilled: (value: T) => Thenable<U>): Thenable<U>;
    then<U>(onFulfilled: (value: T) => U): Thenable<U>;
    then<U>(onFulfilled: (value: T) => Thenable<U>, onRejected: PromiseErrorCallback): Thenable<U>;
    then<U>(onFulfilled: (value: T) => U, onRejected: PromiseErrorCallback): Thenable<U>;
}

declare class Promise<T> implements Thenable<T> {
    _status: string;
    _result: any;
    _rejectReactions: PromiseReaction[];
    _resolveReactions: PromiseReaction[];

    constructor(executor: PromiseExecutor<T>);

    then<U>(onFulfilled: (value: T) => Thenable<U>): Promise<U>;
    then<U>(onFulfilled: (value: T) => U): Promise<U>;
    then<U>(onFulfilled: (value: T) => Thenable<U>, onRejected: PromiseErrorCallback): Promise<U>;
    then<U>(onFulfilled: (value: T) => U, onRejected: PromiseErrorCallback): Promise<U>;

    catch(onRejected: PromiseErrorCallback): Promise<T>;

    static all<T>(promises: Promise<T>[]): Promise<T>;
    static race<T>(promises: Promise<T>[]): Promise<T>;

    static cast<T>(value: any): Promise<T>;

    static resolve<T>(value: T): Promise<T>;
    static resolve<T>(value: any): Promise<T>;

    static reject(reason: Error): Promise<any>;
    static reject(reason: any): Promise<any>;
}

declare module "promise" {
    export = Promise;
}

declare module "promise/extensions" {
    export function timeout(ms?: number): Promise<void>;

    export function module(name: string): Promise<any>;
    export function module(names: string[]): Promise<any[]>;
    export function module(...names: string[]): Promise<any[]>;

    export function forEach<T>(values: T[], executor: (value: T, index: number) => Promise<T>): Promise<T>;
    export function forEach<T>(values: T[], executor: (value: T, index: number) => T): Promise<T>;
    export function forEach<T>(values: T[], executor: (value: T, index: number) => void): Promise<void>;

    export function map<T, U>(values: T[], executor: (value: T, index: number) => Promise<U>): Promise<U[]>;
    export function map<T, U>(values: T[], executor: (value: T, index: number) => U): Promise<U[]>;
}
