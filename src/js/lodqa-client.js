window.onload = function() {
  var _ = require('lodash'),
    bindWebsocketPresentation = function(loader) {
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
    bindAnchoredPgpPresentation = function(loader, presentation) {
      var domId = 'lodqa-results';

      loader
        .on('anchored_pgp', _.partial(presentation.onAnchoredPgp, domId));
    },
    bindResultPresentation = function(loader, presentation) {
      var domId = 'lodqa-results',
        skeltonPresentation = {
          onAnchoredPgp: _.noop,
          onSolution: _.noop,
          onSparql: _.noop
        };

      presentation = _.extend(skeltonPresentation, presentation);

      bindAnchoredPgpPresentation(loader, presentation);
      loader
        .on('sparql', presentation.onSparql)
        .on('solution', presentation.onSolution);
    },
    bindMappingsEditor = function(mappings) {
      var domId = 'lodqa-mappings',
        $region = require('./editor/mappingEditor')(mappings);

      document.getElementById(domId).innerHTML = '';
      $("#" + domId)
        .append($region);
    };

  var loader = require('./loader/loadSolution')();
  // var loader = require('./loader/loadSolutionStub')();

  // bindResultPresentation(loader, require('./presentation/debugPresentation'));
  bindAnchoredPgpPresentation(loader, require('./presentation/anchoredPgpTablePresentation'));
  bindResultPresentation(loader, require('./presentation/sparqlTablePresentation'));
  bindResultPresentation(loader, require('./presentation/solutionTablePresentation'));
  bindResultPresentation(loader, require('./presentation/graphPresentation'));

  bindWebsocketPresentation(loader);
  bindParseRenderingPresentation(loader);

  var mappings = JSON.parse(document.getElementById('lodqa-mappings').innerHTML);
  bindMappingsEditor(mappings);

  $('#beginSerach').on('click', function(e) {
    var $target = $(e.target),
      pgp = JSON.parse(document.getElementById('lodqa-pgp').innerHTML);

    $target.attr('disabled', 'disabled');
    loader.beginSearch(pgp, mappings);
    loader.once('ws_close', function() {
      $target.removeAttr('disabled');
    })
  });
};
