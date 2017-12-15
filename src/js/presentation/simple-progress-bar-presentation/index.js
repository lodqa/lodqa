const render = require('./render')
const setMax = require('./set-max.js')
const setValue = require('./set-value')
const bindHandlerToCheckbox = require('../bind-handler-to-checkbox')

// Render all of the progress bar
module.exports = class {
  constructor(name, onClickDetailCheckbox) {
    const dom = render(name)

    this.dom = dom

    // To switch showing detail of progress
    bindHandlerToCheckbox(this.dom, '.show-detail-progress-bar', (event) => onClickDetailCheckbox(event.target.checked))
  }

  reset() {
    setValue(this.dom, 0)
    setMax(this.dom, 1)
  }

  set max(value) {
    setMax(this.dom, value)
  }

  set checked(value) {
    this.dom.querySelector('.show-detail-progress-bar').checked = value
  }

  progress(value) {
    setValue(this.dom, value)
  }
}
