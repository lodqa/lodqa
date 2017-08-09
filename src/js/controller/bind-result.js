const camelCase = require('camel-case')

const events = [
  'sparql_count',
  'anchored_pgp',
  'solution'
]

module.exports = function(eventEmitter) {
  return (map) => {
    for (const event of events) {
      const callbacks = map[camelCase(event)]

      if (callbacks) {
        for (const callback of callbacks) {
          eventEmitter.on(event, callback)
        }
      }
    }
  }
}
