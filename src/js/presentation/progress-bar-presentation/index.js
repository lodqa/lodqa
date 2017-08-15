const render = require('./render')
const getUniqAnswers = require('../get-uniq-answers')

module.exports = {
  show(domId, total, onSparqlClick) {
    // Render all of the progress bar
    const viewModel = Array.from(Array(total))
      .map((val, index) => ({
        sparqlNumber: index + 1
      }))
    render(domId, viewModel, onSparqlClick)
  },
  progress(domId, solutions, sparqlCount, focusNode) {
    const current = getCurrentSparql(domId, sparqlCount)
    const uniqAnswersLength = getUniqAnswers(solutions, focusNode)
      .length

    // Show number of answers of the solution that was just arrived.
    current.querySelector('.number-of-answers')
      .innerHTML = uniqAnswersLength

    if (uniqAnswersLength) {
      current.classList.add('has-answer')
    } else {
      current.classList.add('no-answer')
    }

    // Show the spinner icon for the next sparql
    const next = current.nextElementSibling
    if (next) {
      next.querySelector('.number-of-answers')
        .innerHTML = '<i class="fa fa-spinner fa-spin fa-fw"></i>'
    }
  },
  stop(domId, sparqlCount, message = '') {
    // The sparql count must be incremented because the next solution is not arrived yet.
    const current = getCurrentSparql(domId, sparqlCount + 1)

    // Hide the spinner icon
    if (current) {
      if (message) {
        current.querySelector('.number-of-answers')
          .innerHTML = `<i class="fa fa-bomb" aria-hidden="true" title="${message}"></i>`
      } else {
        // If a conneciton of websocket is closed
        if (!current.querySelector('.fa-bomb')) {
          current.querySelector('.number-of-answers')
            .innerHTML = ''
        }
      }
    }
  }
}

function getCurrentSparql(domId, sparqlCount) {
  return document.querySelector(`#${domId} [data-sparql-number="${sparqlCount}"]`)
}
