var _ = require('lodash'),
  setFont = require('./setFont'),
  toRed = require('./toRed'),
  updateLinkOnSelect = function(link, springy) {
    springy.event
      .on('selected', function(selected) {
        link
          .text(selected.node.data.url)
          .attr('href', selected.node.data.url);
      });
  },
  Graph = function(domId, options) {
    var graph = new Springy.Graph(),
      link = $('<a target="_blank">'),
      canvas = $('<canvas>')
      .attr(options);

    $('#' + domId)
      .append(link)
      .append(canvas);

    var springy = canvas.springy({
      graph: graph
    });

    updateLinkOnSelect(link, springy);

    return graph;
  },
  toNode = function(term) {
    return new Springy.Node(term.id, term);
  },
  addNode = function(graph, node) {
    graph.addNode(node);
  },
  toBigFont = _.partial(setFont, '18px Verdana, sans-serif'),
  toFocus = _.compose(toRed, toBigFont),
  setFocus = function(focus, term) {
    return term.id === focus ? toFocus(term) : term;
  },
  extendIndex = function(a, index) {
    a.index = index;
    return a;
  },
  threeNodeOrders = {
    t1: [1, 0, 2],
    t2: [0, 1, 2],
    t3: [0, 2, 1]
  },
  getNodeOrder = function(id) {
    return threeNodeOrders[id];
  },
  getTwoEdgeNode = function(edgeCount) {
    return _.first(Object.keys(edgeCount)
      .map(function(id) {
        return {
          id: id,
          count: edgeCount[id]
        };
      })
      .filter(function(node) {
        return node.count === 2;
      })
      .map(function(node) {
        return node.id;
      }));
  },
  countEdge = function(edges) {
    return edges.reduce(function(edgeCount, edge) {
      edgeCount[edge.subject] ++;
      edgeCount[edge.object] ++;
      return edgeCount;
    }, {
      t1: 0,
      t2: 0,
      t3: 0
    });
  },
  getOrderWhenThreeNode = _.compose(getNodeOrder, getTwoEdgeNode, countEdge),
  specialSort = function(nodeOrder, a, b) {
    return nodeOrder[a.index] - nodeOrder[b.index];
  },
  simpleSort = function(a, b) {
    return b.index - a.index;
  },
  anchoredPgpNodePositions = [
    [],
    [{
      x: 0,
      y: 0
    }],
    [{
      x: -20,
      y: 20
    }, {
      x: 20,
      y: -20
    }],
    [{
      x: -40,
      y: 40
    }, {
      x: 0,
      y: 0
    }, {
      x: 40,
      y: -40
    }]
  ],
  setPosition = function(number_of_nodes, term, index) {
    return _.extend(term, {
      position: anchoredPgpNodePositions[number_of_nodes][index]
    });
  },
  addNodes = function(graph, nodes, focus, edges) {
    var sortFuc = nodes.length === 3 ?
      _.partial(specialSort, getOrderWhenThreeNode(edges)) :
      simpleSort;

    nodes
      .map(_.partial(setFocus, focus))
      .map(extendIndex)
      .sort(sortFuc)
      .map(_.partial(setPosition, nodes.length))
      .map(toNode)
      .forEach(_.partial(addNode, graph));
  },
  addEdge = function(graph, edge, node1, node2, color) {
    edge = _.extend(edge, {
      color: color
    });

    return graph.newEdge(node1, node2, edge);
  };

module.exports = function(domId, options) {
  var graph = new Graph(domId, options);

  return {
    graph: graph,
    addNodes: addNodes,
    addEdge: addEdge
  };
};
