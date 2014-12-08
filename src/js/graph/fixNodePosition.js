var _ = require('lodash'),
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
  };

module.exports = function(nodes, edges) {
  var sortFuc = nodes.length === 3 ?
    _.partial(specialSort, getOrderWhenThreeNode(edges)) :
    simpleSort;

  return nodes
    .map(extendIndex)
    .sort(sortFuc)
    .map(_.partial(setPosition, nodes.length))
};
