const getCurrentSparql = require('../get-current-sparql')
const showError = require('../show-error')
const showNumbers = require('./show-numbers')

module.exports = function(dom, uniqAnswersLength, sparqlCount, sparqlTimeout) {
  const current = getCurrentSparql(dom, sparqlCount)
  current.classList.remove('progress-bar__detail-progress-bar__sparqls__sparql--progress')

  if (sparqlTimeout) {
    showError(current, sparqlTimeout.error_message)
  } else {
    // Show number of answers of the solution that was just arrived.
    showNumbers(current, uniqAnswersLength)
  }

  // Show the spinner icon for the next sparql
  const next = current.nextElementSibling
  if (next) {
    next.classList.add('progress-bar__detail-progress-bar__sparqls__sparql--progress')
  }
}
