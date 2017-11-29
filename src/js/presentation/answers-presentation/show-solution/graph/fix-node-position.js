const threeNodeOrders = {
  t1: [1, 0, 2],
  t2: [0, 1, 2],
  t3: [0, 2, 1]
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

module.exports = function(nodes, edges) {
  const sortFuc = nodes.length === 3 ?
    (a, b) => specialSort(getOrderWhenThreeNode(edges), a, b) :
    simpleSort

  return nodes
    .map(extendIndex)
    .sort(sortFuc)
    .map((term, index) => setPosition(nodes.length, term, index))
}

function specialSort(nodeOrder, a, b) {
  return nodeOrder[a.index] - nodeOrder[b.index]
}

function getOrderWhenThreeNode(edges){
  return getNodeOrder(getTwoEdgeNode(countEdge(edges)))
}

function getNodeOrder(id) {
  return threeNodeOrders[id]
}

function getTwoEdgeNode(edgeCount) {
  return Object.keys(edgeCount)
    .map((id) => ({
      id,
      count: edgeCount[id]
    }))
    .filter((node) => node.count === 2)
    .map((node) => node.id)[0]
}

function countEdge(edges) {
  return edges.reduce((edgeCount, edge) => {
    edgeCount[edge.subject] ++
    edgeCount[edge.object] ++
    return edgeCount
  }, {
    t1: 0,
    t2: 0,
    t3: 0
  })
}

function simpleSort(a, b) {
  return b.index - a.index
}

function extendIndex(a, index) {
  a.index = index
  return a
}

function setPosition(number_of_nodes, term, index) {
  return Object.assign(term, {
    position: anchoredPgpNodePositions[number_of_nodes][index]
  })
}
