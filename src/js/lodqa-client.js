window.onload = function() {
  var bindSolutionState = function(loader, presetation) {
      var data = {},
        domId = 'lodqa-results';

      loader
        .on('anchored_pgp', _.partial(presetation.onAnchoredPgp, domId, data))
        .on('solution', _.partial(presetation.onSolution, data));
    },
    bindWebsocketState = function(loader) {
      var presetation = lodqaClient.websocketPresentation;
      loader
        .on('ws_open', presetation.onOpen)
        .on('ws_close', presetation.onClose);
    },
    bindParseRenderingState = function(loader) {
      loader.on("parse_rendering", function(data) {
        document.getElementById('lodqa-parse_rendering').innerHTML = data;
      });
    };

  var loader = require('./loader/loadSolution')();
  // var loader = require('./loader/loadSolutionStub')();

  bindSolutionState(loader, lodqaClient.tablePresentation);
  bindSolutionState(loader, lodqaClient.graphPresentation);
  // bindSolutionState(loader, lodqaClient.debugPresentation);

  bindWebsocketState(loader);
  bindParseRenderingState(loader);
}
