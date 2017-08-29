const updateDisplay = require('./update-display')

module.exports = function(domId, model) {
  const data = model.currentSoluton

  // The data.solutions is empty when the sparql query timed out.
  if (data.sparql_timeout) {
    return
  }

  updateDisplay(domId, model)
  model.findLabel()
}
