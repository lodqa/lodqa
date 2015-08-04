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
    bindMappingsEditor = function(mappings) {
      var domId = 'lodqa-mappings',
        mappings = JSON.parse(document.getElementById(domId).innerHTML),
        $region = require('./editor/mappingEditor')(mappings);

      document.getElementById(domId).innerHTML = '';
      $("#" + domId)
        .append($region);

      return mappings;
    },
    bindResult = require('./controller/bindResult'),
    pgpGraph = require('./graph/pgpGraph'),
    bindPgpPresentation = function() {
      var domId = 'lodqa-pgp',
        pgp = JSON.parse(document.getElementById(domId).innerHTML);
      document.getElementById(domId).innerHTML = '';
      pgpGraph(pgp);

      return pgp;
    };

  var loader = require('./loader/loadSolution')();
  // var loader = require('./loader/loadSolutionStub')();

  // bindResult.all(loader, require('./presentation/debugPresentation'));
  bindResult.anchoredPgp(loader, require('./presentation/anchoredPgpTablePresentation'));
  bindResult.all(loader, require('./presentation/sparqlTablePresentation'));
  bindResult.all(loader, require('./presentation/solutionTablePresentation'));
  bindResult.all(loader, require('./presentation/graphPresentation'));

  bindWebsocketPresentation(loader);
  bindParseRenderingPresentation(loader);

  var pgp = bindPgpPresentation();
  var mappings = bindMappingsEditor(mappings);

  $('#beginSerach').on('click', function(e) {
    var $target = $(e.target);

    $target.attr('disabled', 'disabled');
    loader.beginSearch(pgp, mappings, 'analysis');
    loader.once('ws_close', function() {
      $target.removeAttr('disabled');
    })
  });
};
