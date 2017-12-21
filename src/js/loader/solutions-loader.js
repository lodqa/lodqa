const {EventEmitter} = require('events')

module.exports = class extends EventEmitter{
  constructor() {
    super()
  }

  beginSearch(pgp, mappings, pathname, target, readTimeout) {
    this.ws = openConnection(this, pathname, target, readTimeout)

    this.once('ws_open', () => {
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

function openConnection(emitter, pathname, target, readTimeout) {
  const ws = new WebSocket(`ws://${location.host}${pathname}?target=${target}&read_timeout=${readTimeout}`)

  ws.onopen = function() {
    emitter.emit('ws_open')
  }
  ws.onclose = function() {
    emitter.emit('ws_close')
  }
  ws.onmessage = function(m) {
    const json = JSON.parse(m.data)
    emitter.emit(json.event, json)
  }

  return ws
}
