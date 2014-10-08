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
      var canvas = $('<canvas>')
        .attr({
          width: 690,
          height: 1000
        });
      $('#lodqa-results').append(canvas);
      canvas.springy({
        graph: graph
      });

      return graph;
    },
    toLabel = function(term) {
      var url = decomposeUrl(term.label),
        path = url.path;

      return {
        id: term.id,
        label: url.hash ? url.hash : path[path.length - 1]
      };
    },
    toNode = function(term) {
      return new Springy.Node(term.id, term);
    },
    addNode = function(graph, node) {
      graph.addNode(node);
    },
    toTerm = function(solution, id) {
      return {
        id: id,
        label: solution[id]
      };
    },
    addTxs = function(graph, nodes) {
      Object.keys(nodes)
        .map(function(key) {
          return {
            id: key,
            label: nodes[key].term
          };
        })
        .map(toLabel)
        .map(toNode)
        .forEach(_.partial(addNode, graph));
    },
    addItxs = function(graph, solution) {
      return Object.keys(solution)
        .filter(function(id) {
          return id[0] === 'i';
        })
        .map(_.partial(toTerm, solution))
        .map(toLabel)
        .map(function(term) {
          return {
            id: term.id,
            node: graph.newNode(term)
          };
        });
    },
    addStxs = function(graph, solution, itxs) {
      Object.keys(solution)
        .filter(function(id) {
          return id[0] === 's';
        })
        .map(_.partial(toTerm, solution))
        .map(toLabel)
        .forEach(_.partial(addStxEdge, graph, itxs));
    },
    addStxEdge = function(graph, itxs, term) {
      var tid = term.id.substr(1),
        itx = itxs.filter(function(itx) {
          return itx.id === 'i' + tid
        }).map(function(itx) {
          return itx.node;
        })[0];

      graph.newEdge(graph.nodeSet[tid], itx, term)
    },
    bindGpaph = function(solution) {
      var addNodeGraph, graph;

      solution
        .on('anchored_pgp', function(anchored_pgp) {
          graph = initGraph();
          addTxs(graph, anchored_pgp.nodes);

          console.log(graph);
        })
        .on('solution', function(solution) {
          var itxs = addItxs(graph, solution);

          addStxs(graph, solution, itxs);

          console.log(solution, itxs);
        });
    };

  var solution = loadSolution();

  bindDebug(solution);
  bindGpaph(solution);
}
