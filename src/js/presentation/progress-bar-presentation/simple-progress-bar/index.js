const render = require('./render')
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

  progress(sparqlCount) {
    progressSimple(this.dom, sparqlCount)
  }
}
