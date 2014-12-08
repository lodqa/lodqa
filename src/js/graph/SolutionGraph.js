var _ = require('lodash'),
  instance = require('../presentation/instance'),
  setFont = require('./setFont'),
  toRed = require('./toRed'),
  fixNodePosition = require('./fixNodePosition'),
  transformIf = function(predicate, transform, object) {
    return predicate(object) ? transform(object) : object;
  },
  toLabel = function(term) {
    return {
      id: term.id,
      label: require('../presentation/toLastOfUrl')(term.label),
      url: term.label
    };
  },
  setFontNormal = _.partial(setFont, '8px Verdana, sans-serif'),
  toLabelAndSetFontNormal = _.compose(setFontNormal, toLabel),
  toTerm = function(solution, id) {
    return {
      id: id,
      label: solution[id]
    };
  },
  addEdgeToInstance = function(graph, addEdge, solution, instanceNode) {
    var anchoredPgpNodeId = instanceNode.data.id.substr(1),
      edgeId = 's' + anchoredPgpNodeId,
      anchoredPgpNode = graph.nodeSet[anchoredPgpNodeId],
      edge = toEdge(solution, edgeId);
    addEdge(graph, edge, anchoredPgpNode, instanceNode, '#999999');
  },
  addInstanceNode = function(graph, addEdge, isFocus, solution) {
    var markIfFocus = _.partial(transformIf, _.compose(isFocus, function(term) {
      return term.id;
    }), toRed);

    return Object.keys(solution)
      .filter(instance.is)
      .map(_.partial(toTerm, solution))
      .map(toLabelAndSetFontNormal)
      .map(markIfFocus)
      .reduce(function(result, term) {
        var instanceNode = graph.newNode(term);
        addEdgeToInstance(graph, addEdge, solution, instanceNode);
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
  addPath = function(graph, addEdge, solution, edges, transitNodes, instanceNodes) {
    return Object.keys(solution)
      .filter(function(id) {
        return id[0] === 'p';
      })
      .map(toPathInfo)
      .map(_.partial(toPath, graph, edges, transitNodes, instanceNodes))
      .reduce(function(result, path) {
        var edge = toEdge(solution, path.id);
        result[path.id] = addEdge(graph, edge, path.left, path.right, '#2B5CFF');
        return result;
      }, {});
  },
  toAnchoredPgpNodeTerm = function(nodes, key) {
    return {
      id: key,
      label: nodes[key].term
    };
  },
  addAnchoredPgpNodes = function(graph, addNodes, anchoredPgp) {
    var nodeIds = Object.keys(anchoredPgp.nodes),
      nodes = nodeIds
      .map(_.partial(toAnchoredPgpNodeTerm, anchoredPgp.nodes))
      .map(toLabelAndSetFontNormal);

    nodes = fixNodePosition(nodes, anchoredPgp.edges);

    addNodes(
      graph,
      nodes,
      anchoredPgp.focus
    );
  },
  toEdge = function(solution, edgeId) {
    var edge = Object.keys(solution)
      .filter(function(id) {
        return id === edgeId;
      })
      .map(_.partial(toTerm, solution))
      .map(toLabel)[0];

    return edge;
  };

module.exports = function(domId, options) {
  var graph = require('./lodqaGraph')(domId, options);

  return {
    addAnchoredPgpNodes: _.partial(addAnchoredPgpNodes, graph.graph, graph.addNodes),
    addInstanceNode: _.partial(addInstanceNode, graph.graph, graph.addEdge),
    addTransitNode: _.partial(addTransitNode, graph.graph),
    addPath: _.partial(addPath, graph.graph, graph.addEdge)
  };
};
