(function() {
  this.lodqaClient = this.lodqaClient || {};
  this.lodqaClient.graphPresentation = function() {
    var initGraph = function() {
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
      toSubjectTerm = function(nodes, key) {
        return {
          id: key,
          label: nodes[key].term
        };
      },
      toLabel = function(term) {
        var url = decomposeUrl(term.label),
          path = url.path;

        return {
          id: term.id,
          label: url.hash ? url.hash : path[path.length - 1]
        };
      },
      setFont = function(value, target) {
        return _.extend(target, {
          font: value
        })
      },
      setFontNormal = _.partial(setFont, '8px Verdana, sans-serif'),
      toLabelAndSetFontNormal = _.compose(setFontNormal, toLabel),
      toNode = function(term) {
        return new Springy.Node(term.id, term);
      },
      addNode = function(graph, node) {
        graph.addNode(node);
      },
      toBigFont = _.partial(setFont, '18px Verdana, sans-serif'),
      toRed = function(term) {
        return _.extend(term, {
          color: '#FF512C'
        });
      },
      toFocus = _.compose(toRed, toBigFont),
      setFocus = function(focus, term) {
        return term.id === focus ? toFocus(term) : term;
      },
      subjectPositions = [
        [],
        [{
          x: 0,
          y: 0
        }],
        [{
          x: 0,
          y: 10
        }, {
          x: 10,
          y: 0
        }]
      ],
      setPosition = function(number_of_nodes, term, index) {
        return _.extend(term, {
          position: subjectPositions[number_of_nodes][index]
        });
      },
      addSubjects = function(graph, nodes, focus) {
        var node_ids = Object.keys(nodes);

        node_ids
          .map(_.partial(toSubjectTerm, nodes))
          .map(toLabelAndSetFontNormal)
          .map(_.partial(setFocus, focus))
          .map(_.partial(setPosition, node_ids.length))
          .map(toNode)
          .forEach(_.partial(addNode, graph));
      },
      toTerm = function(solution, id) {
        return {
          id: id,
          label: solution[id]
        };
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
          toNodeData = _.compose(toLabelAndSetFontNormal, _.partial(toTerm, solution)),
          //右手があれば右手に、無ければobjectに繋ぐ
          right = hasIdInSolutin(right_node_id) ? graph.newNode(toNodeData(right_node_id)) : graph.nodeSet[t_objec_id];

        addEdge(graph, solution, 'p' + p_no + p_child_no, left, right, '#2B5CFF');
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
      addSubjectInstances = function(graph, solution, focus) {
        var addSubjectInstanceFromSolution = _.partial(addSubjectInstance, graph, solution);

        Object.keys(solution)
          .filter(function(id) {
            return id[0] === 'i';
          })
          .map(_.partial(toTerm, solution))
          .map(toLabelAndSetFontNormal)
          .map(function(term) {
            var tx_id = term.id.substr(1);
            return tx_id === focus ? toRed(term) : term;
          })
          .forEach(function(term) {
            addSubjectInstanceFromSolution(term, 't2');
          });
      };

    return {
      onAnchoredPgp: function(domId, data, anchored_pgp) {
        data.graph = initGraph();
        data.focus = anchored_pgp.focus;
        addSubjects(data.graph, anchored_pgp.nodes, data.focus);
      },
      onSolution: function(data, solution) {
        addSubjectInstances(data.graph, solution, data.focus);
      }
    };
  }();
}.call(this));