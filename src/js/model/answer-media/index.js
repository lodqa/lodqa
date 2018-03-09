const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    this._rendering = null

    loader.on('answer', ({
      answer
    }) => this._setDefault(answer))
  }

  _setDefault(answer) {
    if (this._rendering) {
      return
    }

    if (answer.urls) {
      const withRendering = answer.urls.filter((u) => u.rendering)
      if (withRendering.length) {
        this._rendering = withRendering[0].rendering
        this.emit('answer_media_update_event')
      }
    }
  }

  select(rendering) {
    this._rendering = rendering
    this.emit('answer_media_update_event')
  }

  get snapshot() {
    return this._rendering
  }
}
