window.onload = function() {
  var loadSolution = function() {
      var show = function(el) {
        return function(msg) {
          el.innerHTML = msg + '<br />' + el.innerHTML;
        }
      }(document.getElementById('lodqa-messages'));

      var ws = new WebSocket('ws://localhost:9292/solutions'),
        emitter = new events.EventEmitter();

      ws.onopen = function() {
        show('websocket opened!');
      };
      ws.onclose = function() {
        show('websocket closed!');
      };
      ws.onmessage = function(m) {
        if (m.data === 'start') return;

        var jsondata = JSON.parse(m.data);
        if ("anchored_pgp" in jsondata) {
          emitter.emit('anchored_pgp', jsondata);
        } else if ("solution" in jsondata) {
          emitter.emit('solution', jsondata);
        } else {
          show('websocket message: ' + m.data);
        }
      };

      return emitter;
    },
    bindDebug = function(solution) {
      var currentRegion;

      solution
        .on('anchored_pgp', function(data) {
          currentRegion = document.createElement('div');
          currentRegion.classList.add('section');
          currentRegion.style.border = "solid black 1px";
          document.getElementById('lodqa-results').appendChild(currentRegion);
          currentRegion.innerHTML = JSON.stringify(data.anchored_pgp.nodes);
        })
        .on('solution', function(data) {
          currentRegion.innerHTML += '<br />' + JSON.stringify(data.solution);
        });
    },
    initGraph = function() {
      var graph = new Springy.Graph();
      var canvas = $('<canvas>');
      $('#lodqa-results').append(canvas);
      canvas.springy({
        graph: graph
      });

      return graph;
    };

  var solution = loadSolution();

  solution.on('anchored_pgp', function(data) {
    console.log(data.anchored_pgp.nodes);

    var graph = initGraph();
    Object.keys(data.anchored_pgp.nodes).forEach(function(key) {
      graph.newNode({
        label: data.anchored_pgp.nodes[key].term
      });
    });
  })

  bindDebug(solution);
}
