(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function() {
  var ws = new WebSocket(location.href.replace('http://', 'ws://')),
    emitter = new events.EventEmitter();

  ws.onopen = function() {
    emitter.emit('ws_open');
  };
  ws.onclose = function() {
    emitter.emit('ws_close');
  };
  ws.onmessage = function(m) {
    if (m.data === 'start') return;

    var jsondata = JSON.parse(m.data);

    ["anchored_pgp", "solution", "parse_rendering"]
    .forEach(function(event) {
      if (jsondata.hasOwnProperty(event)) {
        emitter.emit(event, jsondata[event]);
      }
    });
  };

  return emitter;
};

},{}],2:[function(require,module,exports){
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

},{"./loader/loadSolution":1}]},{},[2]);
