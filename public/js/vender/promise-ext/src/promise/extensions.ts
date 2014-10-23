/// <amd-dependency path="../promise" />
/// <reference path="../promise.d.ts" />

function partial(fn: Function, ...args: any[]) {
    return (..._args: any[]) => {
        return fn.apply(undefined, args.concat(_args));
    };
}

export function timeout(ms: number = 1): Promise<void> {
    return new Promise<void>(resolve => {
        setTimeout(() => { resolve.call(undefined); }, ms);
    });
}

export function module(name: string): Promise<any>;
export function module(names: string[]): Promise<any[]>;
export function module(...names: string[]): Promise<any[]>;
export function module(): Promise<any[]> {
    var args = Array.prototype.slice.call(arguments);
    if (args.length === 0) {
        return Promise.resolve(undefined);
    }

    return new Promise<any>((resolve, reject) => {
        if (args.length === 1 && Object.prototype.toString.call(args[0]) === "[object Array]") {
            args = args[0];
        }

        try {
            require(
                args,
                (...mods: any[]) => { resolve(mods.length === 1 ? mods[0] : mods); },
                (err) => { reject(err); }
            );
        }
        catch (e) {
            reject(e);
        }
    });
}

export function forEach<T>(values: T[], executor: (value: T, index: number) => Promise<T>): Promise<T> {
    if (values.length === 0) {
        return Promise.resolve(undefined);
    }

    return new Promise((resolve, reject) => {
        var p, val,
            i = 0,
            len = values.length;

        p = Promise.resolve(undefined);

        for (; i < len; i++) {
            val = values[i];
            p = p.then(partial(executor, val, i), reject);
        }

        p.then(resolve, reject);
    });
}

export function map<T, U>(values: T[], iterator: (value: T, index: number) => Promise<U>): Promise<U[]> {
    if (values.length === 0) {
        return Promise.resolve([]);
    }

    return new Promise<U[]>((resolve, reject) => {
        var p, val,
            i = 0,
            len = values.length,
            result = [],
            wrapper = function (val, i) {
                return iterator(val, i).then(val => {
                    result.push(val);
                    return val;
                });
            };

        p = Promise.resolve(undefined);

        for (; i < len; i++) {
            val = values[i];
            p = p.then(partial(wrapper, val, i), reject);
        }

        p.then(() => resolve(result), reject);
    });
}
