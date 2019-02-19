const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    this._message = {}

    loader.on('simple:ws_open', () => {
      this._message.isWaittingResult = true
      this.emit('message_update_event')
    })

    loader.on('simple:bs_error', (e) => {
      this._message.error = e
      this.emit('message_update_event')
    })

    // Users can not do anything if looking at backend server errors.
    // We will output these errors to the development console instead of the browser window.
    loader.on('simple:gateway_error', (e) => {
      console.warn(`${e.dataset.name}: ${e.state}`)
    })

    loader.on('simple:sparql', () => {
      this._message.isWaittingResult = false
      this.emit('message_update_event')
    })

    loader.on('simple:finish', (e) => {
      this._message.isWaittingResult = false
      const number_of_founded_sparql = e.states.reduce((sum, elm) => sum + (elm.sparqls ? elm.sparqls : 0), 0)
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
