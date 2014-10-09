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
    addEdge = function(graph, solution, edge_id, node1, node2, color) {
      Object.keys(solution)
        .filter(function(id) {
          return id === edge_id;
        })
        .map(_.partial(toTerm, solution))
        .map(toLabel)
        .forEach(function(term) {
          _.extend(term, {
            color: color
          });
          graph.newEdge(node1, node2, term)
        });
    },
    addStx = function(graph, solution, tx_id, itx) {
      var stx_id = 's' + tx_id;

      addEdge(graph, solution, stx_id, graph.nodeSet[tx_id], itx);
    },
    addXxx = function(graph, solution, t_subject_id, itx) {
      var p_no = parseInt(t_subject_id[1]) - 1;

      Object.keys(solution)
        .filter(function(id) {
          return id === 'x' + p_no + '1';
        })
        .map(_.partial(toTerm, solution))
        .map(toLabel)
        .forEach(function(term) {
          var xxx = graph.newNode(term),
            ids = {
              t_objec_id: 't' + (p_no + 2),
              p_id1: 'p' + p_no + '1',
              p_id2: 'p' + p_no + '2'
            };

          addEdge(graph, solution, ids.p_id1, itx, xxx, '#FF0000');
          addEdge(graph, solution, ids.p_id2, xxx, graph.nodeSet[ids.t_objec_id], '#0000FF');

          console.log(ids);
        });
    },
    addItxs = function(graph, solution) {
      var addStxSolution = _.partial(addStx, graph, solution),
          addXxxSolution = _.partial(addXxx, graph, solution);

      Object.keys(solution)
        .filter(function(id) {
          return id[0] === 'i';
        })
        .map(_.partial(toTerm, solution))
        .map(toLabel)
        .forEach(function(term) {
          var tx_id = term.id.substr(1),
            itx = graph.newNode(term);

          addStxSolution(tx_id, itx);
          addXxxSolution(tx_id, itx);
        });
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
          addItxs(graph, solution);

          console.log(solution);
        });
    };

  var solution = loadSolution();

  bindGpaph(solution);
  bindDebug(solution);
}
