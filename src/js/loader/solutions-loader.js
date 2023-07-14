const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor() {
    super()
  }

  beginSearch(pgp, mappings, pathname, target, readTimeout, sparqlLimit, answerLimit) {
    this.ws = openConnection(this, pathname, target, readTimeout, sparqlLimit, answerLimit)

    this.once('expert:ws_open', () => {
      this.ws.send(JSON.stringify({
        pgp,
        mappings
      }))
    })
  }

  stopSearch() {
    if (this.ws) {
      this.ws.close()
    }
  }
}

function openConnection(emitter, pathname, target, readTimeout, sparqlLimit, answerLimit) {
  const ws = new WebSocket(`${globalThis.lodqa.webSocketSchema}://${location.host}${pathname}?target=${target}&read_timeout=${readTimeout}&sparql_limit=${sparqlLimit}&answer_limit=${answerLimit}`)

  ws.onopen = () => emitter.emit('expert:ws_open')
  ws.onclose = () => emitter.emit('expert:ws_close')
  ws.onmessage = (m) => {
    const json = JSON.parse(m.data)
    emitter.emit(json.event, json)
  }

  return ws
}
