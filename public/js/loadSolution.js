(function() {
  this.lodqaClient = this.lodqaClient || {};
  this.lodqaClient.loadSolution = function() {
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

      if ("anchored_pgp" in jsondata) {
        emitter.emit('anchored_pgp', jsondata.anchored_pgp);
      } else if ("solution" in jsondata) {
        emitter.emit('solution', jsondata.solution);
      }
    };

    return emitter;
  };
}.call(this));
