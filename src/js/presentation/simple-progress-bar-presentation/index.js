const render = require('./render')
const setMax = require('./set-max.js')
const progressSimple = require('./progress-simple')
const bindHandlerToCheckbox = require('../bind-handler-to-checkbox')

// Render all of the progress bar
module.exports = class {
  constructor(name, total, onClickDetailCheckbox) {
    const dom = render(name, total)

    this.dom = dom

    // To switch showing detail of progress
    bindHandlerToCheckbox(this.dom, '.show-detail-progress-bar', (event) => onClickDetailCheckbox(event.target.checked))
  }

  set max(value) {
    setMax(this.dom, value)
  }

  set checked(value) {
    this.dom.querySelector('.show-detail-progress-bar').checked = value
  }

  progress(value) {
    progressSimple(this.dom, value)
  }
}
