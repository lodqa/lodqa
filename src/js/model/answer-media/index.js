const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(mediaSelect) {
    super()

    this._mediaSelect = mediaSelect
    this._selected = null

    mediaSelect.on('media_select_update_event', () => this.emit('answer_media_update_event'))
  }

  get snapshot() {
    const {
      uri,
      index
    } = this._mediaSelect.selected
    const answers = this._mediaSelect.snapshot

    return answers.find((a) => a.uri === uri).urls[index].rendering
  }
}
