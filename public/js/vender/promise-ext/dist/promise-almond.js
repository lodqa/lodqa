define("promise", [], function () {
    var isWellImplemented = function () {
        var resolve;
        new window.Promise(function (r) {
            resolve = r;
        });

        return typeof resolve === "function";
    }, hasPromise = function () {
        return "Promise" in window && "cast" in window.Promise && "resolve" in window.Promise && "reject" in window.Promise && "all" in window.Promise && "race" in window.Promise && isWellImplemented();
    };

    if (!hasPromise()) {
        return require("./promise/class");
    } else {
        return window.Promise;
    }
});
