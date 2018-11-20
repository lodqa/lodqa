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

    loader.on('finish', (e) => {
      this._message.isWaittingResult = false
      const number_of_founded_sparql = e.states.reduce((sum, elm) => sum + elm.sparqls ? Number(elm.sparqls) : 0, 0)
      const message = number_of_founded_sparql === 0 ? 'No result from dictionary lookup.' : 'Search finished!'
      this._message = {
        message
      }
      this.emit('message_update_event')
    })
  }

  get message() {
    return this._message
  }
}
