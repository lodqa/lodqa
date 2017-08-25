const updateDisplay = require('./update-display')

module.exports = function(domId, model, hideSparqls) {
  const data = model.currentSoluton

  // The data.solutions is empty when the sparql query timed out.
  if (data.sparql_timeout) {
    return
  }

  updateDisplay(domId, model.answersMap, hideSparqls)
  model.findLabel((answersMap) => updateLabelAndDisplay(domId, answersMap, hideSparqls))
}

function updateLabelAndDisplay(domId, answersMap, hideSparqls) {
  updateDisplay(domId, answersMap, hideSparqls)
}
