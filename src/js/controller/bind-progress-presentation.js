const progressPresentation = require('../presentation/progress-presentation')

module.exports = function(eventEmitter) {
  const presentation = progressPresentation('lodqa-messages')

  eventEmitter
    .on('ws_open', presentation.onOpen)
    .on('ws_close', presentation.onClose)
    .on('sparql_count', presentation.onSparqlCount)
    .on('solution', presentation.onSolution)
}
