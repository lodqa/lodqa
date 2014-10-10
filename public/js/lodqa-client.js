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
          height: 400
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
    extendFont = function(term) {
      return _.extend(term, {
        font: '8px Verdana, sans-serif'
      })
    },
    toLabelAndExtendFont = _.compose(extendFont, toLabel),
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
    addSubjects = function(graph, nodes) {
      Object.keys(nodes)
        .map(function(key) {
          return {
            id: key,
            label: nodes[key].term
          };
        })
        .map(toLabelAndExtendFont)
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
        .map(function(term) {
          return _.extend(term, {
            color: color
          });
        })
        .forEach(function(term) {
          graph.newEdge(node1, node2, term)
        });
    },
    addEdgeFromSubjectToInstance = function(graph, solution, tx_id, itx) {
      var stx_id = 's' + tx_id;
      addEdge(graph, solution, stx_id, graph.nodeSet[tx_id], itx, '#999999');
    },
    hasId = function(solution, left_node_id) {
      return Object.keys(solution)
        .filter(function(id) {
          return id === left_node_id;
        }).length === 1;
    },
    addEdgeOfPath = function(graph, solution, itx, p_no, t_objec_id, previousRight, path_id) {
      var p_child_no = path_id[2],
        left_node_id = 'x' + p_no + (parseInt(p_child_no) - 1),
        right_node_id = 'x' + p_no + p_child_no,
        hasIdInSolutin = _.partial(hasId, solution),
        //左手があれば前回の右手に、無ければsubject instanceから繋ぐ
        left = hasIdInSolutin(left_node_id) ? previousRight : itx,
        toNodeData = _.compose(toLabelAndExtendFont, _.partial(toTerm, solution)),
        //右手があれば右手に、無ければobjectに繋ぐ
        right = hasIdInSolutin(right_node_id) ? graph.newNode(toNodeData(right_node_id)) : graph.nodeSet[t_objec_id];

      addEdge(graph, solution, 'p' + p_no + p_child_no, left, right, '#0000FF');
      return right;
    },
    addPath = function(graph, solution, t_subject_id, itx, t_objec_id) {
      var p_no = parseInt(t_subject_id[1]) - 1,
        addPathFromSubjectInstanceToObject = _.partial(addEdgeOfPath, graph, solution, itx, p_no, t_objec_id);

      Object.keys(solution)
        .filter(function(id) {
          return id[0] === 'p' && id[1] === String(p_no);
        })
        .reduce(function(previousRight, path_id) {
          return addPathFromSubjectInstanceToObject(previousRight, path_id);
        }, null);
    },
    addSubjectInstance = function(graph, solution, term, endNodeId) {
      var tx_id = term.id.substr(1),
        itx = graph.newNode(term);

      addEdgeFromSubjectToInstance(graph, solution, tx_id, itx);
      addPath(graph, solution, tx_id, itx, endNodeId);
    },
    addSubjectInstances = function(graph, solution) {
      var addSubjectInstanceFromSolution = _.partial(addSubjectInstance, graph, solution);

      Object.keys(solution)
        .filter(function(id) {
          return id[0] === 'i';
        })
        .map(_.partial(toTerm, solution))
        .map(toLabelAndExtendFont)
        .forEach(function(term) {
          addSubjectInstanceFromSolution(term, 't2');
        });
    },
    bindGpaph = function(solution) {
      var addNodeGraph, graph;

      solution
        .on('anchored_pgp', function(anchored_pgp) {
          graph = initGraph();
          addSubjects(graph, anchored_pgp.nodes);
        })
        .on('solution', function(solution) {
          addSubjectInstances(graph, solution);
        });
    };

  var solution = loadSolution();

  bindGpaph(solution);
  bindDebug(solution);
}
