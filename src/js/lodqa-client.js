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

  $('#beginSearch').on('click', function(e) {
    document.getElementById("container").innerHTML = '<h1>Results</h1><div id="lodqa-results"></div>';

    var $target = $(e.target);
    $target.attr('disabled', 'disabled');
    var pgpElement = document.querySelector('.pgp');
    var mappingsElement = document.querySelector('.mappings');
    var pgp = JSON.parse(pgpElement.innerHTML);
    var mappings = JSON.parse(mappingsElement.innerHTML);
    var config_url = document.querySelector('#target').value;
    console.log(config_url);
    loader.beginSearch(pgp, mappings, '/solutions', config_url);
    loader.once('ws_close', function() {
      $target.removeAttr('disabled');
    })
  });

  $('#dashboard').on('click', function(e) {
    $(this).css("z-index", "1")
    $('#main').css("z-index", "-1")
  });

  $('#main').on('click', function(e) {
    $(this).css("z-index", "1")
    $('#dashboard').css("z-index", "-1")
  });

};
