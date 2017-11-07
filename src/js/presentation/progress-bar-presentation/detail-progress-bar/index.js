const bindHandlerToCheckbox = require('../bind-handler-to-checkbox')
const render = require('./render')
const progressDetail = require('./progress-detail')
const stop = require('./stop')

// Render all of the progress bar
module.exports = class {
  constructor(dom, name, total, onChcekChange) {
    const detailProgressBar = render(name, total)
    dom.appendChild(detailProgressBar)

    // Bind an event handler on change events of checkboxes.
    detailProgressBar.addEventListener('change', (e) => {
      const sparql = e.target.closest('.progress-bar__detail-progress-bar__sparqls__sparql')

      if (sparql) {
        onChcekChange(sparql.getAttribute('data-sparql-number'), !e.target.checked)
      }
    })

    // To switch appearance of sparqls
    bindHandlerToCheckbox(detailProgressBar, '.show-only-has-answers', () => toggleShowOnlyHasAnswers(detailProgressBar))

    this.dom = detailProgressBar
  }

  toggleDetail() {
    this.dom.classList.toggle('progress-bar__detail-progress-bar--hidden')
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
