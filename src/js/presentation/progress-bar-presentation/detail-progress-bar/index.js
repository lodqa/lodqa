const bindHandlerToCheckbox = require('../bind-handler-to-checkbox')
const render = require('./render')
const progressDetail = require('./progress-detail')
const stop = require('./stop')

// Render all of the progress bar
module.exports = class {
  constructor(name, onChcekChange, currentStatusOfSparqls) {
    const dom = render(name, currentStatusOfSparqls)

    // Bind an event handler on change events of checkboxes.
    dom.addEventListener('change', (e) => {
      const sparql = e.target.closest('.progress-bar__detail-progress-bar__sparqls__sparql')

      if (sparql) {
        onChcekChange(sparql.getAttribute('data-sparql-number'), !e.target.checked)
      }
    })

    // To switch appearance of sparqls
    bindHandlerToCheckbox(dom, '.show-only-has-answers', () => toggleShowOnlyHasAnswers(dom))

    this.dom = dom
  }

  progress(solutions, sparqlCount, focusNode, sparqlTimeout) {
    progressDetail(this.dom, solutions, sparqlCount, focusNode, sparqlTimeout)
  }

  stop(sparqlCount, errorMessage) {
    stop(this.dom, sparqlCount, errorMessage)
  }
}

function toggleShowOnlyHasAnswers(detailProgressBar) {
  detailProgressBar.classList.toggle('progress-bar__detail-progress-bar--show-only-has-answers')
}
