(function() {
  this.lodqaClient = this.lodqaClient || {};
  this.lodqaClient.loadSolution = function() {
    var show = function(el) {
      return function(msg) {
        el.innerHTML = msg;
      }
    }(document.getElementById('lodqa-messages'));

    var ws = new WebSocket(location.href.replace('http://', 'ws://')),
      emitter = new events.EventEmitter();

    ws.onopen = function() {
      show('lodqa running ...');
    };
    ws.onclose = function() {
      show('lodqa finished.');
    };
    ws.onmessage = function(m) {
      if (m.data === 'start') return;

      var jsondata = JSON.parse(m.data);
      if ("anchored_pgp" in jsondata) {
        emitter.emit('anchored_pgp', jsondata.anchored_pgp);
      } else if ("solution" in jsondata) {
        emitter.emit('solution', jsondata.solution);
      } else {
        show('websocket message: ' + m.data);
      }
    };

    return emitter;
  };
}.call(this));
