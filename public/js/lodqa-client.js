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
          emitter.emit('anchored_pgp', jsondata.anchored_pgp);
        } else if ("solution" in jsondata) {
          emitter.emit('solution', jsondata.solution);
        } else {
          show('websocket message: ' + m.data);
        }
      };

      return emitter;
    },
    bindDebug = function(solution) {
      var currentRegion;

      solution
        .on('anchored_pgp', function(anchored_pgp) {
          currentRegion = document.createElement('div');
          currentRegion.classList.add('section');
          currentRegion.style.border = "solid black 1px";
          document.getElementById('lodqa-results').appendChild(currentRegion);
          currentRegion.innerHTML = JSON.stringify(anchored_pgp.nodes);
        })
        .on('solution', function(solution) {
          currentRegion.innerHTML += '<br />' + JSON.stringify(solution);
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
    },
    toLabel = function(term) {
      var path = decomposeUrl(term.label).path;
      return {
        id: term.id,
        label: path[path.length - 1]
      };
    },
    toNode = function(term) {
      return new Springy.Node(term.id, term);
    },
    addGraph = function(graph, node) {
      graph.addNode(node);
    },
    bindGpaph = function(solution) {
      var addCurrnetGraph;

      solution
        .on('anchored_pgp', function(anchored_pgp) {
          var graph = initGraph();

          addCurrnetGraph = _.partial(addGraph, graph);

          Object.keys(anchored_pgp.nodes)
            .map(function(key) {
              return {
                id: key,
                label: anchored_pgp.nodes[key].term
              };
            })
            .map(toLabel)
            .map(toNode)
            .forEach(addCurrnetGraph);

          console.log(graph);
        })
        .on('solution', function(solution) {
          Object.keys(solution)
            .filter(function(id) {
              return id[0] === 'i';
            })
            .map(function(id) {
              return {
                id: id,
                label: solution[id]
              };
            })
            .map(toLabel)
            .map(toNode)
            .forEach(addCurrnetGraph);

          console.log(solution);
        });
    };

  var solution = loadSolution();

  bindDebug(solution);
  bindGpaph(solution);
}
