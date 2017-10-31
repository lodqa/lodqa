const getUniqAnswers = require('../../../answer/get-uniq-answers')
const getCurrentSparql = require('../get-current-sparql')
const showError = require('../show-error')
const getNumberOfAnswers = require('../get-number-of-answers')

module.exports = function(dom, solutions, sparqlCount, focusNode, sparqlTimeout) {
  const current = getCurrentSparql(dom, sparqlCount)
  current.classList.remove('progress-bar__detail-progress-bar__sparqls__sparql--progress')

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
    next.classList.add('progress-bar__detail-progress-bar__sparqls__sparql--progress')
  }
}

function showNumbers(dom, uniqAnswersLength) {
  getNumberOfAnswers(dom)
    .innerHTML = uniqAnswersLength

  if (uniqAnswersLength) {
    dom.classList.add('progress-bar__detail-progress-bar__sparqls__sparql--has-answer')
  } else {
    dom.classList.add('progress-bar__detail-progress-bar__sparqls__sparql--no-answer')
  }
}
