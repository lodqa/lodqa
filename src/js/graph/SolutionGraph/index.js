const lodqaGraph = require('../lodqaGraph')
const addAnchoredPgpNodes = require('./addAnchoredPgpNodes')
const addInstanceNode = require('./addInstanceNode')
const addTransitNode = require('./addTransitNode')
const addPath = require('./addPath')

module.exports = function(options, className) {
  const graph = lodqaGraph(options, className)

  return {
    addAnchoredPgpNodes: (anchoredPgp) => addAnchoredPgpNodes(graph.graph, graph.addNodes, anchoredPgp),
    addInstanceNode: (isFocus, bgp, solution) => addInstanceNode(graph.graph, graph.addEdge, isFocus, bgp, solution),
    addTransitNode: (solution) => addTransitNode(graph.graph, solution),
    addPath: (bgp, solution, edges, transitNodes, instanceNodes) => addPath(graph, bgp, solution, edges, transitNodes, instanceNodes),
    updateLabel: (url, label) => graph.updateLabel(url, label),
    dom: graph.dom
  }
}
