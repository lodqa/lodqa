const websocketPresentation = require('../presentation/websocketPresentation')

module.exports = function bindWebsocketPresentation(loader) {
  const presentation = websocketPresentation('lodqa-messages')
  loader
    .on('ws_open', presentation.onOpen)
    .on('ws_close', presentation.onClose)
    .on('sparql_count', presentation.onSparqlCount)
    .on('solution', presentation.onSolution)
}
