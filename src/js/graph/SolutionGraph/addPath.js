const toEdge = require('./toEdge')
const toPath = require('./toPath')

module.exports = function(graph, solution, edges, transitNodes, instanceNodes) {
  return Object.keys(solution)
    .filter((id) => id[0] === 'p')
    .map(toPathInfo)
    .map((pathInfo) => toPath(graph.graph, edges, transitNodes, instanceNodes, pathInfo))
    .reduce((result, path) => {
      const edge = toEdge(solution, path.id)

      result[path.id] = graph.addEdge(graph.graph, edge, path.source, path.target, '#2B5CFF')

      return result
    }, {})
}

function toPathInfo(pathId) {
  return {
    id: pathId,
    no: pathId[1],
    childNo: parseInt(pathId[2])
  }
}
