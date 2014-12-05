var EventEmitter = require('events').EventEmitter,
  _ = require('lodash');

module.exports = function() {
  var ws = new WebSocket(location.href.replace('http://', 'ws://').replace('analysis', 'solutions')),
    emitter = new EventEmitter;

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

  return _.extend(emitter, {
    beginSearch: function() {
      ws.send(JSON.stringify({
        pgp: {
          "nodes": {
            "t1": {
              "head": 2,
              "text": "side effects"
            },
            "t2": {
              "head": 6,
              "text": "streptomycin"
            }
          },
          "edges": [{
            "subject": "t1",
            "object": "t2",
            "text": "associated with"
          }],
          "focus": "t1"
        },
        mappings: {
          "side effects": ["http://www4.wiwiss.fu-berlin.de/sider/resource/sider/side_effects", "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffectName"],
          "streptomycin": ["http://www4.wiwiss.fu-berlin.de/drugbank/resource/drugs/DB01082", "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297", "http://www4.wiwiss.fu-berlin.de/drugbank/resource/drugs/DB00428", "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5300"]
        }
      }));
    }
  });
};
