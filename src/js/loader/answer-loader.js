const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor() {
    super()
  }

  begin(pathname, params) {
    this._ws = openConnection(this, pathname, params)
  }

  stop() {
    if (this._ws) {
      this.ws.close()
    }
  }
}

function openConnection(emitter, pathname, params) {
  const queryParameters = toQueryParameters(params)
  const url = `ws://${location.host}${pathname}${queryParameters ? `?${queryParameters}` : ''}`
  const ws = new WebSocket(url)
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

function toQueryParameters(paramsMap) {
  const params = []
  for (const [key, value] of paramsMap.entries()) {
    params.push(`${key}=${value}`)
  }
  return params.join('&')
}
