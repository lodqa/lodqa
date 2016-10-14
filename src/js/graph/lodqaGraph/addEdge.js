module.exports = function(graph, edge, sourceNode, targetNode, color) {
  const data = Object.assign({}, edge, {
    color
  })

  return graph.newEdge(sourceNode, targetNode, data)
}
