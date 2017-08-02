const progressPresentation = require('../presentation/progress-presentation')

module.exports = function(loader) {
  const presentation = progressPresentation('lodqa-messages')

  loader
    .on('ws_open', presentation.onOpen)
    .on('ws_close', presentation.onClose)
    .on('sparql_count', presentation.onSparqlCount)
    .on('solution', presentation.onSolution)
}
