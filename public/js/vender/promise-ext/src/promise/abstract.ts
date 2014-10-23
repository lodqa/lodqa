/// <reference path="../promise.d.ts" />

import status = require("./status");
import tasks = require("./tasks");
import utils = require("./utils");

/**
 * Try to handle a thenable object if possible
 * @param {Promise} promise Promise related with this test
 * @param {any} value Value to test thenability
 * @returns {boolean} True if a thenable object was found
 */
export function initializePromise<T>(promise: Promise<T>, executor: PromiseExecutor<T>): Promise<T> {
    promise._status = status.unresolved;
    promise._resolveReactions = [];
    promise._rejectReactions = [];

    var resolve = createResolveFunction(promise),
        reject = createRejectFunction(promise);

    try {
        executor(resolve, reject);
    }
    catch (e) {
        reject.call(undefined, e);
    }

    return promise;
}

/**
 * Create Promise rejection function
 * @param {Promise} promise Promise to create rejection function for
 * @returns {PromiseRejectFunction} A function which reject promise using reason argument
 */
export function createRejectFunction(promise: Promise<any>): PromiseRejectFunction {
    return (reason: any) => {
        if (promise._status !== status.unresolved) {
            return;
        }

        var reactions = promise._rejectReactions;
        promise._result = reason;
        promise._rejectReactions = undefined;
        promise._resolveReactions = undefined;

        promise._status = status.rejected;

        return triggerPromiseReaction(reactions, reason);
    };
}

/**
 * Create Promise resolution function
 * @param {Promise} promise Promise to create resolution function for
 * @returns {PromiseResolveFunction} A function which resolve promise using resolution argument
 */
export function createResolveFunction<T>(promise: Promise<T>): PromiseResolveFunction<T> {
    return (resolution: any) => {
        if (promise._status !== status.unresolved) {
            return;
        }

        var reactions = promise._resolveReactions;
        promise._result = resolution;
        promise._rejectReactions = undefined;
        promise._resolveReactions = undefined;

        promise._status = status.resolved;

        return triggerPromiseReaction(reactions, resolution);
    };
}

/**
 * Create Promise then resolution handler function
 * @param {Promise} promise Promise to create resolution function for
 * @param {PromiseCallback} onFulfilled Callback to be called whenever promise fulfills
 * @param {PromiseCallback} onRejected Callback to be called whenever promise fails
 * @returns {PromiseResolveFunction} A function which resolve promise using resolution argument
 */
export function createResolutionHandlerFunction<T>(promise: Promise<T>, onFulfilled: (resolution: T) => any, onRejected: PromiseErrorCallback): PromiseResolveFunction<T> {
    return (resolution: any) => {
        if (resolution === promise) {
            var err = new TypeError("Handler result cannot be same promise as input");
            return onRejected.call(undefined, err);
        }

        var ctor = (<any>promise).constructor,
            capability = newPromiseCapability(ctor);

        if (updatePromiseFromPotentialThenable(resolution, capability)) {
            return utils.invoke(capability.promise, "then", [onFulfilled, onRejected]);
        }
        
        return onFulfilled.call(undefined, resolution);
    };
}

/**
 * Create a Promise Capability using given Promise-like constructor
 * @param {Function} ctor Constructor which accepts Promise-like initialization
 * @returns {PromiseCapability}
 */
export function newPromiseCapability<T>(Ctor: any): PromiseCapability<T> {
    if (!utils.isConstructor(Ctor)) {
        throw new TypeError("newPromiseCapability only accept a constructor as argument");
    }

    var capability: PromiseCapability<T> = { promise: undefined, resolve: undefined, reject: undefined };
    capability.promise = new Ctor((resolve: PromiseResolveFunction<T>, reject: PromiseRejectFunction) => {
        capability.resolve = resolve;
        capability.reject = reject;
    });

    if (!utils.isCallable(capability.resolve)) {
        throw new TypeError("Given constructor type does not provide an acceptable resolve function");
    }

    if (!utils.isCallable(capability.reject)) {
        throw new TypeError("Given constructor type does not provide an acceptable reject function");
    }

    return capability;
}

/**
 * Check if given argument is a promise
 * @param x Value to test
 * @returns {boolean} True if given value is a Promise
 */
export function isPromise(x: any): boolean {
    return utils.isObject(x) && !utils.isUndefined(x._status);
}

/**
 * Trigger each reactions with given value by enqueing tasks to task queue
 * @param {PromiseReaction[]} reactions Reactions to trigger with value
 * @param {any} value value to trigger reactions with
 */
export function triggerPromiseReaction(reactions: PromiseReaction[], value: any): void {
    var i = 0, len = reactions.length,
        reaction;

    for (; i < len; i++) {
        reaction = reactions[i];
        tasks.enqueue(PromiseReactionTask, [reaction, value]);
    }
}

/**
 * Test if given value is a thenable. If so, it try to use values's then method to resolve capability else it returns false
 * @param {any} value Value to test if it is a Thenable
 * @param {PromiseCapability} capability Capability to resolve if value is a thenable
 * @returns {boolean} True if value is a thenable
 */
export function updatePromiseFromPotentialThenable<T>(value: any, capability: PromiseCapability<T>): boolean {
    try {
        if (utils.isObject(value) && utils.isCallable(value.then)) {
            value.then.call(value, capability.resolve, capability.reject);
            return true;
        }
    }
    catch (e) {
        capability.reject.call(null, e);
        return true;
    }

    return false;
}

/**
 * Trigger given reaction with given value and check for handler result to know how to resolve promise
 * @param {PromiseReaction} reaction Reaction to trigger with given value
 * @param {any} value Value to trigger reaction with
 */
export function PromiseReactionTask(reaction: PromiseReaction, value: any): void {
    if (!reaction || !reaction.capability || !reaction.handler) {
        throw new TypeError("PromiseReactionTask take a promise reaction record as first argument");
    }

    var capability = reaction.capability,
        handler = reaction.handler,
        handlerResult;

    try {
        handlerResult = handler.call(undefined, value);
    }
    catch (e) {
        return capability.reject.call(undefined, e);
    }

    if (handlerResult === capability.promise) {
        var err = new TypeError("Handler result cannot be same promise as input");
        return capability.reject.call(undefined, err);
    }

    if (!updatePromiseFromPotentialThenable(handlerResult, capability)) {
        return capability.resolve.call(undefined, handlerResult);
    }
}
