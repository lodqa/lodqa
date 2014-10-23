var abstract = require("./abstract");
var status = require("./status");
var tasks = require("./tasks");
var utils = require("./utils");

var Promise = (function () {
    function Promise(executor) {
        this._status = status.waiting;
        if (!utils.isCallable(executor)) {
            throw new TypeError("You must pass a resolver function as the first argument to the promise constructor");
        }

        if (!(this instanceof Promise)) {
            throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
        }

        abstract.initializePromise(this, executor);
    }
    Promise.prototype.then = function (onFulfilled, onRejected) {
        var self = this, ctor = this.constructor, capability = abstract.newPromiseCapability(ctor);

        if (!utils.isCallable(onRejected)) {
            onRejected = utils.thrower;
        }

        if (!utils.isCallable(onFulfilled)) {
            onFulfilled = utils.identity;
        }

        var resolveReaction = { capability: capability, handler: abstract.createResolutionHandlerFunction(self, onFulfilled, onRejected) }, rejectReaction = { capability: capability, handler: onRejected };

        if (this._status === status.unresolved) {
            this._resolveReactions.push(resolveReaction);
            this._rejectReactions.push(rejectReaction);
        } else if (this._status === status.resolved) {
            tasks.enqueue(abstract.PromiseReactionTask, [resolveReaction, self._result]);
        } else if (this._status === status.rejected) {
            tasks.enqueue(abstract.PromiseReactionTask, [rejectReaction, self._result]);
        }

        return capability.promise;
    };

    Promise.prototype.catch = function (onRejected) {
        return this.then(undefined, onRejected);
    };

    Promise.resolve = function (value) {
        var ctor = this, capability = abstract.newPromiseCapability(ctor);

        capability.resolve.call(undefined, value);
        return capability.promise;
    };

    Promise.reject = function (reason) {
        var ctor = this, capability = abstract.newPromiseCapability(ctor);

        capability.reject.call(undefined, reason);
        return capability.promise;
    };

    Promise.cast = function (value) {
        var ctor = this;
        if (abstract.isPromise(value) && value.constructor === ctor) {
            return value;
        }

        var capability = abstract.newPromiseCapability(ctor);
        capability.resolve.call(undefined, value);

        return capability.promise;
    };

    Promise.all = function (promises) {
        var ctor = this, capability = abstract.newPromiseCapability(ctor), values = [], remaining = 0, len = promises.length, i = 0, promise;

        if (len === 0) {
            capability.resolve.call(undefined, values);
            return capability.promise;
        }

        function createResolveElement(index) {
            return function (value) {
                values[index] = value;
                remaining--;

                if (remaining === 0) {
                    capability.resolve.call(undefined, values);
                }
            };
        }

        for (; i < len; i++) {
            promise = promises[i];

            try  {
                promise = utils.invoke(ctor, "cast", [promise]);
                utils.invoke(promise, "then", [createResolveElement(i), capability.reject]);
            } catch (e) {
                capability.reject.call(undefined, e);
                return capability.promise;
            }

            remaining++;
        }

        return capability.promise;
    };

    Promise.race = function (promises) {
        var ctor = this, capability = abstract.newPromiseCapability(ctor), i = 0, len = promises.length, promise;

        for (; i < len; i++) {
            promise = promises[i];

            try  {
                promise = utils.invoke(ctor, "cast", [promise]);
                utils.invoke(promise, "then", [capability.resolve, capability.reject]);
            } catch (e) {
                capability.reject.call(undefined, e);
                return capability.promise;
            }
        }

        return capability.promise;
    };
    return Promise;
})();

var g = typeof global !== "undefined" ? global : window;
g.Promise = Promise;

module.exports = Promise;
