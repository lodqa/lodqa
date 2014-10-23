define(["require", "exports"], function(require, exports) {
    function isCallable(value) {
        return typeof value === "function";
    }
    exports.isCallable = isCallable;

    function isObject(value) {
        return (typeof value === "object" && value !== null);
    }
    exports.isObject = isObject;

    function isConstructor(value) {
        return (exports.isCallable(value) && value.prototype && value.prototype.constructor === value);
    }
    exports.isConstructor = isConstructor;

    function isUndefined(value) {
        return typeof value === "undefined";
    }
    exports.isUndefined = isUndefined;

    function hasProperty(obj, prop) {
        return (prop in obj);
    }
    exports.hasProperty = hasProperty;

    function invoke(obj, fn, args) {
        if (typeof args === "undefined") { args = []; }
        if (!exports.hasProperty(obj, fn) || !exports.isCallable(obj[fn])) {
            throw new TypeError("Object has no " + fn + " function");
        }

        return obj[fn].apply(obj, args);
    }
    exports.invoke = invoke;

    function identity(value) {
        return value;
    }
    exports.identity = identity;

    
    function thrower(e) {
        if (!(e instanceof Error)) {
            e = new Error(e);
        }

        throw e;
    }
    exports.thrower = thrower;
});
