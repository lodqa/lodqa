var timeout = require("./timeout");

var queue = [], isStarted = false;

function execute() {
    timeout(function () {
        if (queue.length === 0) {
            isStarted = false;
            return;
        }

        var task = queue.shift(), executor = task.executor, args = task.args;

        executor.apply(undefined, args);

        execute();
    });
}

function start() {
    if (isStarted) {
        return;
    }

    isStarted = true;
    execute();
}

function enqueue(executor, args) {
    queue.push({
        executor: executor,
        args: args
    });

    start();
}
exports.enqueue = enqueue;

function clear() {
    queue = [];
}
exports.clear = clear;
