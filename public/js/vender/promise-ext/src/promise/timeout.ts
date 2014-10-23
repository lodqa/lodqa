/// <reference path="../../_definitions.d.ts" />
/// <reference path="../promise.d.ts" />

function _nextTick(callback: () => void): void {
    process.nextTick(callback);
}

function _setTimeout(callback: () => void): void {
    setTimeout(callback, 1);
}

var result: (callback: () => void) => void;

if (typeof process !== "undefined" && {}.toString.call(process) === "[object process]") {
    result = _nextTick;
}
else {
    result = _setTimeout;
}

export = result;
