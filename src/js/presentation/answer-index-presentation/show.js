const findLabel = require('../find-label')
const getUniqAnswers = require('../get-uniq-answers')
const addAnswersOfSparql = require('./add-answers-of-sparql')
const updateDisplay = require('./update-display')

module.exports = function(domId, answersMap, data, sparqlNumber, focusNode, hideSparqls) {
  const uniqAnswers = getUniqAnswers(data.solutions, focusNode)

  addAnswersOfSparql(
    answersMap,
    uniqAnswers,
    sparqlNumber,
    data.sparql
  )

  updateDisplay(domId, answersMap, hideSparqls)

  findLabel(
    uniqAnswers.map((answer) => answer.url),
    (url, label) => updateLabelAndDisplay(domId, answersMap, url, label, hideSparqls)
  )
}

function updateLabelAndDisplay(domId, answersMap, url, label, hideSparqls) {
  answersMap.get(url)
    .label = label
  updateDisplay(domId, answersMap, hideSparqls)
}
