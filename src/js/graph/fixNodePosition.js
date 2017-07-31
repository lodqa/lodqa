const extendIndex = function(a, index) {
  a.index = index
  return a
}
const threeNodeOrders = {
  t1: [1, 0, 2],
  t2: [0, 1, 2],
  t3: [0, 2, 1]
}
const getNodeOrder = function(id) {
  return threeNodeOrders[id]
}
const getTwoEdgeNode = function(edgeCount) {
  return Object.keys(edgeCount)
    .map(function(id) {
      return {
        id: id,
        count: edgeCount[id]
      }
    })
    .filter(function(node) {
      return node.count === 2
    })
    .map(function(node) {
      return node.id
    })[0]
}
const countEdge = function(edges) {
  return edges.reduce(function(edgeCount, edge) {
    edgeCount[edge.subject] ++
    edgeCount[edge.object] ++
    return edgeCount
  }, {
    t1: 0,
    t2: 0,
    t3: 0
  })
}
const getOrderWhenThreeNode = function(edges){
  getNodeOrder(getTwoEdgeNode(countEdge(edges)))
}
const specialSort = function(nodeOrder, a, b) {
  return nodeOrder[a.index] - nodeOrder[b.index]
}
const simpleSort = function(a, b) {
  return b.index - a.index
}
const anchoredPgpNodePositions = [
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
]
const setPosition = function(number_of_nodes, term, index) {
  return Object.assign(term, {
    position: anchoredPgpNodePositions[number_of_nodes][index]
  })
}

module.exports = function(nodes, edges) {
  var sortFuc = nodes.length === 3 ?
    (a, b) => specialSort(getOrderWhenThreeNode(edges), a, b) :
    simpleSort

  return nodes
    .map(extendIndex)
    .sort(sortFuc)
    .map((term, index) => setPosition(nodes.length, term, index))
}
