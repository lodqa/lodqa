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
    };

  var loader = lodqaClient.loadSolution();
  // var loader = lodqaClient.loadSolutionStub();

  bindSolutionState(loader, lodqaClient.tablePresentation);
  bindSolutionState(loader, lodqaClient.graphPresentation);
  // bindSolutionState(loader, lodqaClient.debugPresentation);

  bindWebsocketState(loader);
}
