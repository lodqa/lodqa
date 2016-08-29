var EventEmitter = require('events').EventEmitter

module.exports = function() {
  var emitter = new EventEmitter,
    openConnection = function(pathname, config) {
      var ws = new WebSocket('ws://' + location.host + pathname + '?target=' + config)

      ws.onopen = function() {
        emitter.emit('ws_open')
      }
      ws.onclose = function() {
        emitter.emit('ws_close')
      }
      ws.onmessage = function(m) {
        if (m.data === 'start') return

        var jsondata = JSON.parse(m.data);

        ['anchored_pgp', 'solution', 'parse_rendering']
        .forEach(function(event) {
          if (jsondata.hasOwnProperty(event)) {
            emitter.emit(event, jsondata[event])
          }
        })
      }

      return ws
    }

  return Object.assign(emitter, {
    beginSearch: function(pgp, mappings, pathname, config) {
      const ws = openConnection(pathname, config)

      emitter.once('ws_open', function() {
        ws.send(JSON.stringify({
          pgp,
          mappings
        }))
      })
    }
  })
}
