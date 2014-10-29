window.onload = function() {
  var bindSolutionState = function(loader, presentation) {
      var data = {},
        domId = 'lodqa-results';

      loader
        .on('anchored_pgp', _.partial(presentation.onAnchoredPgp, domId, data))
        .on('solution', _.partial(presentation.onSolution, data));
    },
    bindWebsocketState = function(loader) {
      var presentation = require('./presentation/websocketPresentation');
      loader
        .on('ws_open', presentation.onOpen)
        .on('ws_close', presentation.onClose);
    },
    bindParseRenderingState = function(loader) {
      loader.on("parse_rendering", function(data) {
        document.getElementById('lodqa-parse_rendering').innerHTML = data;
      });
    };

  var loader = require('./loader/loadSolution')();
  // var loader = require('./loader/loadSolutionStub')();

  bindSolutionState(loader, require('./presentation/tablePresentation'));
  bindSolutionState(loader, require('./presentation/graphPresentation'));
  bindSolutionState(loader, require('./presentation/debugPresentation'));

  bindWebsocketState(loader);
  bindParseRenderingState(loader);
}
