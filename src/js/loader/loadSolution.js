module.exports = function() {
  var ws = new WebSocket(location.href.replace('http://', 'ws://')),
    event = require('events'),
    emitter = new event.EventEmitter;

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
