define(["require", "exports", "./status", "./tasks", "./utils"], function(require, exports, status, tasks, utils) {
    function initializePromise(promise, executor) {
        promise._status = status.unresolved;
        promise._resolveReactions = [];
        promise._rejectReactions = [];

        var resolve = exports.createResolveFunction(promise), reject = exports.createRejectFunction(promise);

        try  {
            executor(resolve, reject);
        } catch (e) {
            reject.call(undefined, e);
        }

        return promise;
    }
    exports.initializePromise = initializePromise;

    function createRejectFunction(promise) {
        return function (reason) {
            if (promise._status !== status.unresolved) {
                return;
            }

            var reactions = promise._rejectReactions;
            promise._result = reason;
            promise._rejectReactions = undefined;
            promise._resolveReactions = undefined;

            promise._status = status.rejected;

            return exports.triggerPromiseReaction(reactions, reason);
        };
    }
    exports.createRejectFunction = createRejectFunction;

    function createResolveFunction(promise) {
        return function (resolution) {
            if (promise._status !== status.unresolved) {
                return;
            }

            var reactions = promise._resolveReactions;
            promise._result = resolution;
            promise._rejectReactions = undefined;
            promise._resolveReactions = undefined;

            promise._status = status.resolved;

            return exports.triggerPromiseReaction(reactions, resolution);
        };
    }
    exports.createResolveFunction = createResolveFunction;

    function createResolutionHandlerFunction(promise, onFulfilled, onRejected) {
        return function (resolution) {
            if (resolution === promise) {
                var err = new TypeError("Handler result cannot be same promise as input");
                return onRejected.call(undefined, err);
            }

            var ctor = promise.constructor, capability = exports.newPromiseCapability(ctor);

            if (exports.updatePromiseFromPotentialThenable(resolution, capability)) {
                return utils.invoke(capability.promise, "then", [onFulfilled, onRejected]);
            }

            return onFulfilled.call(undefined, resolution);
        };
    }
    exports.createResolutionHandlerFunction = createResolutionHandlerFunction;

    function newPromiseCapability(Ctor) {
        if (!utils.isConstructor(Ctor)) {
            throw new TypeError("newPromiseCapability only accept a constructor as argument");
        }

        var capability = { promise: undefined, resolve: undefined, reject: undefined };
        capability.promise = new Ctor(function (resolve, reject) {
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
    exports.newPromiseCapability = newPromiseCapability;

    function isPromise(x) {
        return utils.isObject(x) && !utils.isUndefined(x._status);
    }
    exports.isPromise = isPromise;

    function triggerPromiseReaction(reactions, value) {
        var i = 0, len = reactions.length, reaction;

        for (; i < len; i++) {
            reaction = reactions[i];
            tasks.enqueue(exports.PromiseReactionTask, [reaction, value]);
        }
    }
    exports.triggerPromiseReaction = triggerPromiseReaction;

    function updatePromiseFromPotentialThenable(value, capability) {
        try  {
            if (utils.isObject(value) && utils.isCallable(value.then)) {
                value.then.call(value, capability.resolve, capability.reject);
                return true;
            }
        } catch (e) {
            capability.reject.call(null, e);
            return true;
        }

        return false;
    }
    exports.updatePromiseFromPotentialThenable = updatePromiseFromPotentialThenable;

    function PromiseReactionTask(reaction, value) {
        if (!reaction || !reaction.capability || !reaction.handler) {
            throw new TypeError("PromiseReactionTask take a promise reaction record as first argument");
        }

        var capability = reaction.capability, handler = reaction.handler, handlerResult;

        try  {
            handlerResult = handler.call(undefined, value);
        } catch (e) {
            return capability.reject.call(undefined, e);
        }

        if (handlerResult === capability.promise) {
            var err = new TypeError("Handler result cannot be same promise as input");
            return capability.reject.call(undefined, err);
        }

        if (!exports.updatePromiseFromPotentialThenable(handlerResult, capability)) {
            return capability.resolve.call(undefined, handlerResult);
        }
    }
    exports.PromiseReactionTask = PromiseReactionTask;
});
