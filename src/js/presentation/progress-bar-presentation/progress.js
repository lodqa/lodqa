const getUniqAnswers = require('../get-uniq-answers')
const getCurrentSparql = require('./get-current-sparql')

module.exports = function progress(domId, solutions, sparqlCount, focusNode) {
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
}
