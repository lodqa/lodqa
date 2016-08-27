var EventEmitter = require('events').EventEmitter

module.exports = function() {
  var emitter = new EventEmitter,
    openConnection = function(pathname, config, verbose) {
      var ws = new WebSocket('ws://' + location.host + pathname + '?target=' + config)

      ws.onopen = function() {
        emitter.emit('ws_open')
      }
      ws.onclose = function() {
        emitter.emit('ws_close')
      }
      ws.onmessage = function(m) {
        if (m.data === 'start') return

        var jsondata = JSON.parse(m.data);

        ['anchored_pgp', 'solution', 'parse_rendering']
        .forEach(function(event) {
          if (jsondata.hasOwnProperty(event)) {
            if(event === 'solution'){
              if(jsondata[event].solutions.length > 0 || verbose){
                emitter.emit(event, jsondata[event])
              }
            }else{
              emitter.emit(event, jsondata[event])
            }
          }
        })
      }

      return ws
    }

  return Object.assign(emitter, {
    beginSearch: function(pgp, mappings, pathname, config, verbose) {
      const ws = openConnection(pathname, config, verbose)

      emitter.once('ws_open', function() {
        ws.send(JSON.stringify({
          pgp,
          mappings
        }))
      })
    }
  })
}
