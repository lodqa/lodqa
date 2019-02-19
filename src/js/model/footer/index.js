const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    const answerSet = new Set()

    loader.on('simple:ws_open', () => {
      this._state = 'footer--searching'
      this.emit('footer_update_event')
    })

    loader.on('simple:answer', ({
      answer
    }) => {
      answerSet.add(answer[1])

      if (answerSet.size > 3) {
        this._state = 'footer--with-answer'
        this.emit('footer_update_event')
      }
    })
  }

  get state() {
    return this._state
  }
}
