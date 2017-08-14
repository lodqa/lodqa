const events = [
  'ws_open',
  'ws_close',
  'sparql_count',
  'anchored_pgp',
  'solution',
  'error'
]

module.exports = function(eventEmitter) {
  return (map) => {
    for (const event of events) {
      const callbacks = map[event]

      if (callbacks) {
        for (const callback of callbacks) {
          eventEmitter.on(event, callback)
        }
      }
    }
  }
}
