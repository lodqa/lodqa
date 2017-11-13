const addNodes = require('./add-nodes')
const addEdge = require('./add-edge')
const Graph = require('./Graph')

module.exports = function(options, className) {
  const [graph, dom] = new Graph(options, className)

  return {
    graph,
    addNodes,
    addEdge,
    updateLabel: (url, label) => {
      graph.nodes
        .filter((element) => element.data.url === url && element.data.label !== label)
        .forEach((element) => element.data.label = label)

      graph.edges
        .filter((element) => element.data.url === url && element.data.label !== label)
        .forEach((element) => element.data.label = label)
    },
    dom
  }
}
