const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor() {
    super()
  }

  begin(pathname, query, target, readTimeout) {
    this._ws = openConnection(this, pathname, query, target, readTimeout)
  }

  stop() {
    if (this._ws) {
      this.ws.close()
    }
  }
}

function openConnection(emitter, pathname, query, target, readTimeout) {
  const ws = new WebSocket(`ws://${location.host}${pathname}?query=${query}&target=${target}&read_timeout=${readTimeout}`)
  ws.onopen = () => emitter.emit('open')
  ws.onclose = () => emitter.emit('close')
  ws.onmessage = ({
    data
  }) => {
    // console.log(data)
    const json = JSON.parse(data)
    emitter.emit(json.event, json)
  }

  return ws
}
