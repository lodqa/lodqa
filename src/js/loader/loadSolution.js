var EventEmitter = require('events').EventEmitter,
  _ = require('lodash');

module.exports = function() {
  var emitter = new EventEmitter,
    openConnection = function(page_name) {
      var ws = new WebSocket(location.href.replace('http://', 'ws://').replace(page_name, 'solutions'));

      ws.onopen = function() {
        emitter.emit('ws_open');
      };
      ws.onclose = function() {
        emitter.emit('ws_close');
      };
      ws.onmessage = function(m) {
        if (m.data === 'start') return;

        var jsondata = JSON.parse(m.data);

        ['anchored_pgp', 'sparql', 'solution', 'parse_rendering']
        .forEach(function(event) {
          if (jsondata.hasOwnProperty(event)) {
            emitter.emit(event, jsondata[event]);
          }
        });
      };

      return ws;
    };

  return _.extend(emitter, {
    beginSearch: function(pgp, mappings, page_name) {
      var ws = openConnection(page_name);
      emitter.once('ws_open', function() {
        ws.send(JSON.stringify({
          pgp: pgp,
          mappings: mappings
        }))
      });
    }
  });
};
