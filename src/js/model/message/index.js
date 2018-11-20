const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    this._message = {}

    loader.on('open', () => {
      this._message.isWaittingResult = true
      this.emit('message_update_event')
    })

    loader.on('gateway_error', (e) => {
      this._message.error = {
        error_message: `${e.dataset.name}: ${e.state}`
      }
      this.emit('message_update_event')
    })

    loader.on('sparql', () => {
      this._message.isWaittingResult = false
      this.emit('message_update_event')
    })
  }

  get message() {
    return this._message
  }
}
