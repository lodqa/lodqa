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
      toAnchoredPgpNodeTerm = function(nodes, key) {
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
      anchoredPgpNodePositions = [
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
        }],
        [{
          x: 0,
          y: 10
        }, {
          x: 5,
          y: 0
        }, {
          x: 10,
          y: 10
        }]
      ],
      setPosition = function(number_of_nodes, term, index) {
        return _.extend(term, {
          position: anchoredPgpNodePositions[number_of_nodes][index]
        });
      },
      addAnchoredPgpNodes = function(graph, nodes, focus) {
        var node_ids = Object.keys(nodes);

        node_ids
          .map(_.partial(toAnchoredPgpNodeTerm, nodes))
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
      addEdge = function(graph, solution, edgeId, node1, node2, color) {
        return _.first(Object.keys(solution)
          .filter(function(id) {
            return id === edgeId;
          })
          .map(_.partial(toTerm, solution))
          .map(toLabel)
          .map(function(term) {
            return _.extend(term, {
              color: color
            });
          })
          .map(function(term) {
            return graph.newEdge(node1, node2, term)
          }));
      },
      addEdgeToInstance = function(graph, solution, instanceNode) {
        var anchoredPgpNodeId = instanceNode.data.id.substr(1),
          edge_id = 's' + anchoredPgpNodeId,
          anchoredPgpNode = graph.nodeSet[anchoredPgpNodeId];
        addEdge(graph, solution, edge_id, anchoredPgpNode, instanceNode, '#999999');
      },
      addInstanceNode = function(graph, solution, focus) {
        return Object.keys(solution)
          .filter(function(id) {
            return id[0] === 'i';
          })
          .map(_.partial(toTerm, solution))
          .map(toLabelAndSetFontNormal)
          .map(function(term) {
            var tx_id = term.id.substr(1);
            return tx_id === focus ? toRed(term) : term;
          })
          .reduce(function(result, term) {
            var instanceNode = graph.newNode(term);
            addEdgeToInstance(graph, solution, instanceNode);
            result[term.id] = instanceNode;
            return result;
          }, {});
      },
      addTransitNode = function(graph, solution) {
        return Object.keys(solution)
          .filter(function(id) {
            return id[0] === 'x';
          })
          .map(_.partial(toTerm, solution))
          .map(toLabelAndSetFontNormal)
          .reduce(function(result, term) {
            result[term.id] = graph.newNode(term);
            return result;
          }, {});
      },
      toPathInfo = function(pathId) {
        return {
          id: pathId,
          no: pathId[1],
          childNo: parseInt(pathId[2])
        }
      },
      toLeftId = function(edge, pathInfo) {
        var anchoredPgpNodeId = edge.subject,
          instanceNodeId = 'i' + anchoredPgpNodeId;

        return {
          transitNodeId: 'x' + pathInfo.no + (pathInfo.childNo - 1),
          instanceNodeId: 'i' + anchoredPgpNodeId,
          anchoredPgpNodeId: anchoredPgpNodeId
        };
      },
      toRightId = function(edge, pathInfo) {
        var anchoredPgpNodeId = edge.object,
          instanceNodeId = 'i' + anchoredPgpNodeId;

        return {
          transitNodeId: 'x' + pathInfo.no + pathInfo.childNo,
          instanceNodeId: 'i' + anchoredPgpNodeId,
          anchoredPgpNodeId: anchoredPgpNodeId
        };
      },
      toGraphId = function(transitNodes, instanceNodes, canididateIds) {
        if (transitNodes[canididateIds.transitNodeId]) {
          return transitNodes[canididateIds.transitNodeId].id;
        } else if (instanceNodes[canididateIds.instanceNodeId]) {
          return instanceNodes[canididateIds.instanceNodeId].id
        } else {
          return canididateIds.anchoredPgpNodeId;
        }
      },
      toPath = function(graph, edges, transitNodes, instanceNodes, pathInfo) {
        var edge = edges[pathInfo.no],
          toGraphIdFromNodes = _.partial(toGraphId, transitNodes, instanceNodes),
          toGraphNode = _.compose(function(id) {
            return graph.nodeSet[id];
          }, toGraphIdFromNodes);

        return {
          id: pathInfo.id,
          left: toGraphNode(toLeftId(edge, pathInfo)),
          right: toGraphNode(toRightId(edge, pathInfo))
        };
      },
      addPath = function(graph, solution, edges, transitNodes, instanceNodes) {
        return Object.keys(solution)
          .filter(function(id) {
            return id[0] === 'p';
          })
          .map(toPathInfo)
          .map(_.partial(toPath, graph, edges, transitNodes, instanceNodes))
          .reduce(function(result, path) {
            result[path.id] = addEdge(graph, solution, path.id, path.left, path.right, '#2B5CFF');
            return result;
          }, {});
      };

    return {
      onAnchoredPgp: function(domId, data, anchored_pgp) {
        data.graph = initGraph();
        data.focus = anchored_pgp.focus;
        data.edges = anchored_pgp.edges;
        addAnchoredPgpNodes(data.graph, anchored_pgp.nodes, data.focus);
      },
      onSolution: function(data, solution) {
        var instanceNodes = addInstanceNode(data.graph, solution, data.focus),
          transitNodes = addTransitNode(data.graph, solution);

        addPath(data.graph, solution, data.edges, transitNodes, instanceNodes);
      }
    };
  }();
}.call(this));
