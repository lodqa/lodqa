const createDom = require('../create-dom')
const bindHandlerToCheckbox = require('../bind-handler-to-checkbox')
const render = require('./render')
const stop = require('./stop')

// Render all of the progress bar
module.exports = class {
  constructor(dataset, onChcekChange) {
    const dom = createDom('<div class="progress-bar__detail-progress-bar"></div>')

    // Render contents
    render(dom, dataset)

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
    this._bindEventListeners(dataset)
  }

  stop(sparqlCount, errorMessage) {
    stop(this.dom, sparqlCount, errorMessage)
  }

  dispose() {
    // Remove event listners.
    this._dataset.removeListener('solution_add_event', this._onSolutionAdd)
    this._dataset.removeListener('error', this._onStop)
    this._dataset.removeListener('ws_close', this._onStop)
  }

  _bindEventListeners(dataset) {
    this._dataset = dataset
    this._onSolutionAdd = () => render(this.dom, this._dataset)
    this._dataset.on('solution_add_event', this._onSolutionAdd)

    this._onStop = () => this.stop(this._dataset.sparqlCount, this._dataset.errorMessage)
    this._dataset.on('error', this._onStop)
    this._dataset.on('ws_close', this._onStop)
  }
}

function toggleShowOnlyHasAnswers(detailProgressBar) {
  detailProgressBar.classList.toggle('progress-bar__detail-progress-bar--show-only-has-answers')
}
