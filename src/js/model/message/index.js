const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    loader.on('open', () => {
      this._message = '<i class="fa fa-spinner fa-spin fa-fw"></i>'
      this.emit('message_update_event')
    })

    loader.on('bgp', () => {
      this._message = ''
      this.emit('message_update_event')
    })
  }

  get message() {
    return this._message
  }
}
