// Bind callbacks to the eventEmitter.
// An eventMap is excepted like:
// {
//   event1: [
//     callback1,
//     callback2
//   ],
//   event2: [
//     callback1
//   ]
// }
module.exports = function(eventEmitter, eventMap) {
  for (const [event, callbacks] of new Map(Object.entries(eventMap)).entries()) {
    if (!callbacks) {
      return
    }

    for (const callback of callbacks) {
      eventEmitter.on(event, callback)
    }
  }
}
