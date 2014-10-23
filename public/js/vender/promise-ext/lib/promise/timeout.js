function _nextTick(callback) {
    process.nextTick(callback);
}

function _setTimeout(callback) {
    setTimeout(callback, 1);
}

var result;

if (typeof process !== "undefined" && {}.toString.call(process) === "[object process]") {
    result = _nextTick;
} else {
    result = _setTimeout;
}

module.exports = result;
