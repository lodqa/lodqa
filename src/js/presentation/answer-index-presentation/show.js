const findLabel = require('../find-label')
const getUniqAnswers = require('../get-uniq-answers')
const addAnswersOfSparql = require('./add-answers-of-sparql')
const updateDisplay = require('./update-display')

module.exports = function(domId, answersMap, data, sparqlNumber, focusNode) {
  const uniqAnswers = getUniqAnswers(data.solutions, focusNode)

  addAnswersOfSparql(
    answersMap,
    uniqAnswers,
    sparqlNumber,
    data.sparql
  )

  updateDisplay(domId, answersMap)

  findLabel(
    uniqAnswers.map((answer) => answer.url),
    (url, label) => updateLabelAndDisplay(domId, answersMap, url, label)
  )
}

function updateLabelAndDisplay(domId, answersMap, url, label) {
  answersMap.get(url)
    .label = label
  updateDisplay(domId, answersMap)
}
