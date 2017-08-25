const getUniqAnswers = require('../../../answer/get-uniq-answers')
const getCurrentSparql = require('../get-current-sparql')
const showError = require('../show-error')
const getNumberOfAnswers = require('../get-number-of-answers')

module.exports = function(domId, solutions, sparqlCount, focusNode, sparqlTimeout) {
  const current = getCurrentSparql(domId, sparqlCount)

  if (sparqlTimeout) {
    showError(current, sparqlTimeout.error_message)
  } else {
    const uniqAnswersLength = getUniqAnswers(solutions, focusNode)
      .length

    // Show number of answers of the solution that was just arrived.
    showNumbers(current, uniqAnswersLength)
  }

  // Show the spinner icon for the next sparql
  const next = current.nextElementSibling
  if (next) {
    showSpinner(next)
  }
}

function showNumbers(dom, uniqAnswersLength) {
  getNumberOfAnswers(dom)
    .innerHTML = uniqAnswersLength

  if (uniqAnswersLength) {
    dom.classList.add('has-answer')
  } else {
    dom.classList.add('no-answer')
  }
}

function showSpinner(dom){
  getNumberOfAnswers(dom)
    .innerHTML = '<i class="fa fa-spinner fa-spin fa-fw"></i>'
}
