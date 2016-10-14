const lodqaGraph = require('../lodqaGraph')
const addAnchoredPgpNodes = require('./addAnchoredPgpNodes')
const addInstanceNode = require('./addInstanceNode')
const addTransitNode = require('./addTransitNode')
const addPath = require('./addPath')

module.exports = function(options, className) {
  const graph = lodqaGraph(options, className)

  return {
    addAnchoredPgpNodes: (anchoredPgp) => addAnchoredPgpNodes(graph.graph, graph.addNodes, anchoredPgp),
    addInstanceNode: (isFocus, solution) => addInstanceNode(graph.graph, graph.addEdge, isFocus, solution),
    addTransitNode: (solution) => addTransitNode(graph.graph, solution),
    addPath: (solution, edges, transitNodes, instanceNodes) => addPath(graph, solution, edges, transitNodes, instanceNodes),
    dom: graph.dom
  }
}
