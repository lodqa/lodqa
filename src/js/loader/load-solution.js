const {EventEmitter} = require('events')

module.exports = class {
  constructor() {
    this.eventEmitter = new EventEmitter()
  }

  beginSearch(pgp, mappings, pathname, config) {
    this.ws = openConnection(this.eventEmitter, pathname, config)

    this.eventEmitter.once('ws_open', () => {
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
  const ws = new WebSocket(`ws://${location.host}${pathname}?target=${config}`)

  ws.onopen = function() {
    emitter.emit('ws_open')
  }
  ws.onclose = function() {
    emitter.emit('ws_close')
  }
  ws.onmessage = function(m) {
    if (m.data === 'start') return

    const jsondata = JSON.parse(m.data);

    ['sparql_count', 'anchored_pgp', 'solution', 'error']
      .forEach((event) => {
        if (jsondata.hasOwnProperty(event)) {
          emitter.emit(event, jsondata[event])
        }
      })
  }

  return ws
}
