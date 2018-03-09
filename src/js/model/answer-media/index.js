const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    this._answers = new Map()
    this._rendering = null

    loader.on('answer', ({
      answer
    }) => this._pushAnswer(answer))
  }

  _pushAnswer(answer) {
    this._answers.set(answer.uri, answer.urls)
    if (!this._rendering) {
      this._setDefault(answer)
    }
  }

  _setDefault(answer) {
    if (answer.urls) {
      const withRendering = answer.urls.filter((u) => u.rendering)
      if (withRendering.length) {
        this._rendering = withRendering[0].rendering
        this.emit('answer_media_update_event')
      }
    }
  }

  select(uri, index) {
    const {
      rendering
    } = this._answers.get(uri)[index]

    this._rendering = rendering
    this.emit('answer_media_update_event')
  }

  get snapshot() {
    return this._rendering
  }
}
