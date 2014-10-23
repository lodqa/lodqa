define("promise", [], function () {
    function isWellImplemented() {
        var resolve;
        new window.Promise(function (r) {
            resolve = r;
        });

        return typeof resolve === "function";
    }

    function hasPromise() {
        return "Promise" in window
            && "cast" in window.Promise
            && "resolve" in window.Promise
            && "reject" in window.Promise
            && "all" in window.Promise
            && "race" in window.Promise
            && isWellImplemented();
    }

    var Promise = hasPromise() ? window.Promise : require("promise/class"),
        extensions = require("promise/extensions"),
        key;

    for (key in extensions) {
        Promise[key] = extensions[key];
    }

    return Promise;
});
