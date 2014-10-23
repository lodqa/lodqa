if (typeof process !== "undefined" && {}.toString.call(process) === "[object process]") {
    global.Promise = require("./promise/class");
    exports = global.Promise;
} else {
    var win = window, isWellImplemented = function () {
        var resolve;
        new win.Promise(function (r) {
            resolve = r;
        });

        return typeof resolve === "function";
    }, hasPromise = function () {
        return "Promise" in win && "cast" in win.Promise && "resolve" in win.Promise && "reject" in win.Promise && "all" in win.Promise && "race" in win.Promise && isWellImplemented();
    };

    if (!hasPromise()) {
        define(["promise/class"], function (Promise) {
            return Promise;
        });
    } else {
        define([], function () {
            return win.Promise;
        });
    }
}
