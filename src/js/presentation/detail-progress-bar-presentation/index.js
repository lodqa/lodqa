const createDom = require('../create-dom')
const bindHandlerToCheckbox = require('../bind-handler-to-checkbox')
const render = require('./render')

// Render all of the progress bar
module.exports = class {
  constructor(dataset) {
    const dom = createDom('<div class="progress-bar__detail-progress-bar"></div>')

    // Render contents
    render(dom, dataset)

    // Bind an event handler on change events of checkboxes.
    dom.addEventListener('change', (e) => {
      const sparql = e.target.closest('.progress-bar__detail-progress-bar__sparqls__sparql')

      if (sparql) {
        dataset.updateSparqlHideStatus(sparql.getAttribute('data-sparql-number'), !e.target.checked)
      }
    })

    // To switch appearance of sparqls
    bindHandlerToCheckbox(dom, '.show-only-has-answers', () => toggleShowOnlyHasAnswers(dom))

    this.dom = dom
    this._bindEventListeners(dataset)
  }

  dispose() {
    // Remove event listners.
    this._dataset.removeListener('solution_add_event', this._upddateDisplay)
    this._dataset.removeListener('state_change_event', this._upddateDisplay)
  }

  _bindEventListeners(dataset) {
    this._dataset = dataset
    this._upddateDisplay = () => render(this.dom, this._dataset)
    this._dataset.on('solution_add_event', this._upddateDisplay)
    this._dataset.on('state_change_event', this._upddateDisplay)
  }
}

function toggleShowOnlyHasAnswers(detailProgressBar) {
  detailProgressBar.classList.toggle('progress-bar__detail-progress-bar--show-only-has-answers')
}
