const instance = require('../../../instance')
const SolutionGraph = require('./Solution-graph')

module.exports = function(anchoredPgp, bgp, solutions) {
  const graph = new SolutionGraph({
    width: 690,
    height: 400
  }, ['answers-region__graph', 'answers-region__graph--hide'])

  graph.addAnchoredPgpNodes(anchoredPgp)

  for (const solution of solutions) {
    const isFocus = (solution) => instance.isNodeId(anchoredPgp.focus, solution)
    const instanceNodes = graph.addInstanceNode(isFocus, bgp, solution)
    const transitNodes = graph.addTransitNode(solution)

    graph.addPath(bgp, solution, anchoredPgp.edges, transitNodes, instanceNodes)
  }

  return graph
}
