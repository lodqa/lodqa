/// <reference path="../promise.d.ts" />
import abstract = require("./abstract");
import status = require("./status");
import tasks = require("./tasks");
import utils = require("./utils");

class Promise<T> {
    public _status: string = status.waiting;
    public _result: any;

    public _rejectReactions: PromiseReaction[];
    public _resolveReactions: PromiseReaction[];

    constructor(executor: PromiseExecutor<T>) {
        if (!utils.isCallable(executor)) {
            throw new TypeError("You must pass a resolver function as the first argument to the promise constructor");
        }

        if (!(this instanceof Promise)) {
            throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
        }

        abstract.initializePromise(this, executor);
    }

    /**
     * Create a new Promise by chaining given callback to current Promise
     * @param {PromiseCallback} onFulfilled Callback to be called when Promise fulfills
     * @param {PromiseCallback} [onRejected] Callback to be called when Promise fails
     * @returns {Promise} Chained Promise
     */
    public then<U>(onFulfilled: (resolution: T) => any): Promise<U>;
    public then<U>(onFulfilled: (resolution: T) => any, onRejected: PromiseErrorCallback): Promise<U>;
    public then<U>(onFulfilled: (resolution: T) => any, onRejected?: PromiseErrorCallback): Promise<U> {
        var self = this,
            ctor = (<any>this).constructor,
            capability = abstract.newPromiseCapability(ctor);

        if (!utils.isCallable(onRejected)) {
            onRejected = utils.thrower;
        }

        if (!utils.isCallable(onFulfilled)) {
            onFulfilled = utils.identity;
        }

        var resolveReaction = { capability: capability, handler: abstract.createResolutionHandlerFunction(self, onFulfilled, onRejected) },
            rejectReaction = { capability: capability, handler: onRejected };

        if (this._status === status.unresolved) {
            this._resolveReactions.push(resolveReaction);
            this._rejectReactions.push(rejectReaction);
        }
        else if (this._status === status.resolved) {
            tasks.enqueue(abstract.PromiseReactionTask, [resolveReaction, self._result]);
        }
        else if (this._status === status.rejected) {
            tasks.enqueue(abstract.PromiseReactionTask, [rejectReaction, self._result]);
        }

        return capability.promise;
    }

    /**
     * The catch function allows to apply a callback on rejection handler.
     * It is equivalent to promise.then(undefined, onRejected)
     * @param {PromiseCallback} onRejected callback to be called whenever promise fail
     * @returns {Promise} A chained Promise which handle error and fullfil
     */
    public catch(onRejected): Promise<T> {
        return this.then(undefined, onRejected);
    }

    /**
     * The resolve function returns a new promise resolved with the passed argument.
     * @param {any} value Value to resolve promise with
     * @returns {Promise} Resolved Promise
     */
    static resolve<T>(value: T): Promise<T> {
        var ctor = this,
            capability = abstract.newPromiseCapability(ctor);

        capability.resolve.call(undefined, value);
        return capability.promise;
    }

    /**
     * The reject function returns a new promise rejected with the passed argument.
     * @param {any} reason Reason to reject promise
     * @returns {Promise} Rejected Promise
     */
    static reject<T>(reason: any): Promise<T> {
        var ctor = this,
            capability = abstract.newPromiseCapability(ctor);

        capability.reject.call(undefined, reason);
        return capability.promise;
    }

    /**
     * The cast function check if value is a Promise return it or convert value to a resolved promise
     * @param {any} value Value to test if promise or not and to convert if not
     * @returns {Promise} Input value if it's a Promise else a new resolved Promise
     */
    static cast<T>(value: any): Promise<T> {
        var ctor = this;
        if (abstract.isPromise(value) && value.constructor === ctor) {
            return value;
        }

        var capability = abstract.newPromiseCapability(ctor);
        capability.resolve.call(undefined, value);

        return capability.promise;
    }

    /**
     * A Promise.all resolve element function is an anonymous built-in function that is used to resolve a specific Promise.all element.
     * @param {Array} promises Promises to check completion
     * @returns {Promise} A Promise which resolve when all of given promises fulfill and reject whenever one fail
     */
    static all<T>(promises: any[]): Promise<T> {
        var ctor = this,
            capability = abstract.newPromiseCapability(ctor),
            values = [],
            remaining = 0,
            len = promises.length,
            i = 0,
            promise;

        if (len === 0) {
            capability.resolve.call(undefined, values);
            return capability.promise;
        }

        function createResolveElement(index: number): (any) => any {
            return value => {
                values[index] = value;
                remaining--;

                if (remaining === 0) {
                    capability.resolve.call(undefined, values);
                }
            };
        }

        for (; i < len; i++) {
            promise = promises[i];

            try {
                promise = utils.invoke(ctor, "cast", [promise]);
                utils.invoke(promise, "then", [createResolveElement(i), capability.reject]);
            }
            catch (e) {
                capability.reject.call(undefined, e);
                return capability.promise;
            }

            remaining++;
        }

        return capability.promise;
    }

    /**
     * The race function returns a new promise which is settled in the same way as the first passed promise to settle. It casts all elements of the passed iterable to promises as it runs this algorithm.
     * @param {Array} promises Promises to perform race with
     * @returns {Promise} A Promise which resolve whenever one of given promises fulfill and reject whenever one fail
     */
    static race<T>(promises: any[]): Promise<T> {
        var ctor = this,
            capability = abstract.newPromiseCapability(ctor),
            i = 0, len = promises.length,
            promise;

        for (; i < len; i++) {
            promise = promises[i];

            try {
                promise = utils.invoke(ctor, "cast", [promise]);
                utils.invoke(promise, "then", [capability.resolve, capability.reject]);
            }
            catch (e) {
                capability.reject.call(undefined, e);
                return capability.promise;
            }
        }

        return capability.promise;
    }
}

var g = typeof global !== "undefined" ? global : window;
g.Promise = Promise;

export = Promise;
