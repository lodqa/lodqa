const render = require('./render')
const progressSimple = require('./progress-simple')

// Render all of the progress bar
module.exports = class {
  constructor(dom, name, total) {
    const simpleProgressBar = render(name, total)

    dom.appendChild(simpleProgressBar)

    this.dom = simpleProgressBar
  }

  progress(sparqlCount) {
    progressSimple(this.dom, sparqlCount)
  }
}
