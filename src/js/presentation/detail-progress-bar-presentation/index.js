const createDom = require('../create-dom')
const bindHandlerToCheckbox = require('../bind-handler-to-checkbox')
const render = require('./render')
const progressDetail = require('./progress-detail')
const stop = require('./stop')

// Render all of the progress bar
module.exports = class {
  constructor(name, onChcekChange) {
    const dom = createDom(`
      <div class="progress-bar__detail-progress-bar">
        <div>
            <input type="checkbox" id="show-only-has-answers-${name}" class="show-only-has-answers">
            <label for="show-only-has-answers-${name}">Show only sparqls with answers</label>
        </div>
      </div>`)

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

  set dataset(newDataset) {
    if (newDataset) {
      this._onSolutionAdd = () => this.progress(newDataset.currentUniqAnswersLength, newDataset.sparqlCount, newDataset.currentSolution.sparqlTimeout)
      newDataset.on('solution_add_event', this._onSolutionAdd)

      this._onStop = () => this.stop(newDataset.sparqlCount, newDataset.errorMessage)
      newDataset.on('error', this._onStop)
      newDataset.on('ws_close', this._onStop)

      this._dataset = newDataset
    } else {
      this._dataset.removeListener('solution_add_event', this._onSolutionAdd)
      this._dataset.removeListener('error', this._onStop)
      this._dataset.removeListener('ws_close', this._onStop)
    }
  }

  showCurrentStatus(currentStatusOfSparqls) {
    this.dom.appendChild(render(currentStatusOfSparqls))
  }

  progress(uniqAnswersLength, sparqlCount, sparqlTimeout) {
    progressDetail(this.dom, uniqAnswersLength, sparqlCount, sparqlTimeout)
  }

  stop(sparqlCount, errorMessage) {
    stop(this.dom, sparqlCount, errorMessage)
  }
}

function toggleShowOnlyHasAnswers(detailProgressBar) {
  detailProgressBar.classList.toggle('progress-bar__detail-progress-bar--show-only-has-answers')
}
