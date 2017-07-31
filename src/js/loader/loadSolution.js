const EventEmitter = require('events').EventEmitter

module.exports = class extends EventEmitter {
  beginSearch(pgp, mappings, pathname, config) {
    this.ws = openConnection(this, pathname, config)

    this.once('ws_open', function() {
      this.ws.send(JSON.stringify({
        pgp,
        mappings
      }))
    })
  }

  stopSearch() {
    if(this.ws){
      this.ws.close()
    }
  }
}

function openConnection(emitter, pathname, config) {
  const ws = new WebSocket('ws://' + location.host + pathname + '?target=' + config)

  ws.onopen = function() {
    emitter.emit('ws_open')
  }
  ws.onclose = function() {
    emitter.emit('ws_close')
  }
  ws.onmessage = function(m) {
    if (m.data === 'start') return

    const jsondata = JSON.parse(m.data);

    ['sparql_count', 'anchored_pgp', 'solution', 'parse_rendering']
      .forEach(function(event) {
        if (jsondata.hasOwnProperty(event)) {
          emitter.emit(event, jsondata[event])
        }
      })
  }

  return ws
}
