const addNodes = require('./addNodes')
const addEdge = require('./addEdge')
const Graph = require('./Graph')

module.exports = function(options, className) {
  const [graph, dom] = new Graph(options, className)

  return {
    graph,
    addNodes,
    addEdge,
    dom
  }
}
