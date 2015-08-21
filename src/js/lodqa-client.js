window.onload = function() {
  var bindWebsocketPresentation = function(loader) {
      var presentation = require('./presentation/websocketPresentation')('lodqa-messages');
      loader
        .on('ws_open', presentation.onOpen)
        .on('ws_close', presentation.onClose);
    },
    bindParseRenderingPresentation = function(loader) {
      loader.on("parse_rendering", function(data) {
        document.getElementById('lodqa-parse_rendering').innerHTML = data;
      });
    },
    bindResult = require('./controller/bindResult');

  var loader = require('./loader/loadSolution')();
  // var loader = require('./loader/loadSolutionStub')();

  // bindResult.all(loader, require('./presentation/debugPresentation'));
  bindResult.anchoredPgp(loader, require('./presentation/anchoredPgpTablePresentation'));
  bindResult.all(loader, require('./presentation/sparqlTablePresentation'));
  bindResult.all(loader, require('./presentation/solutionTablePresentation'));
  bindResult.all(loader, require('./presentation/graphPresentation'));

  bindWebsocketPresentation(loader);
  bindParseRenderingPresentation(loader);

  $('#beginSerach').on('click', function(e) {
    var $target = $(e.target);

    $target.attr('disabled', 'disabled');
    var pgpElement = document.querySelector('.pgp')
    var mappingsElement = document.querySelector('.mappings')
    var pgp = JSON.parse(pgpElement.innerHTML)
    var mappings = JSON.parse(mappingsElement.innerHTML)

    loader.beginSearch(pgp, mappings, 'analysis');
    loader.once('ws_close', function() {
      $target.removeAttr('disabled');
    })
  });
};
