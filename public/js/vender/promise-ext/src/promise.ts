/// <reference path="promise.d.ts" />
/// <reference path="../_definitions.d.ts" />

// NodeJS : no need to check as node does not support es6 yet
if (typeof process !== "undefined" && {}.toString.call(process) === "[object process]") {
    global.Promise = require("./promise/class");
    exports = global.Promise;
}
// Browser : check for implementation and apply it to window
else {
    var win = <any>window,
        isWellImplemented = () => {
            var resolve;
            new win.Promise(function (r) { resolve = r; });

            return typeof resolve === "function";
        },
        hasPromise = () => {
            return "Promise" in win &&
                // Some of these methods are missing from Firefox/Chrome experimental implementations
                "cast" in win.Promise &&
                "resolve" in win.Promise &&
                "reject" in win.Promise &&
                "all" in win.Promise &&
                "race" in win.Promise &&
                // Older version of the spec had a resolver object as the arg rather than a function
                isWellImplemented();
        };

    if (!hasPromise()) {
        define(["promise/class"], (Promise) => Promise);
    }
    else {
        define([], () => win.Promise);
    }
}
