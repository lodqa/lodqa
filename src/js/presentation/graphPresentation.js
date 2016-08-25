var _ = require('lodash'),
  instance = require('./instance'),
  SolutionGraph = require('../graph/SolutionGraph'),
  privateData = {}

module.exports = {
  onAnchoredPgp(domId, anchored_pgp) {
    privateData.domId = domId
    privateData.anchoredPgp = anchored_pgp
    privateData.focus = anchored_pgp.focus
    privateData.edges = anchored_pgp.edges
  },
  onSparql() {},
  onSolution(solutions) {
    if(!Array.isArray(solutions))
      return

    if(solutions.length === 0)
      return

    const graph = new SolutionGraph(privateData.domId, {
      width: 690,
      height: 400
    })
    graph.addAnchoredPgpNodes(privateData.anchoredPgp)

    for (const solution of solutions) {
      var isFocus = _.partial(instance.isNodeId, privateData.focus),
        instanceNodes = graph.addInstanceNode(isFocus, solution),
        transitNodes = graph.addTransitNode(solution)

      graph.addPath(solution, privateData.edges, transitNodes, instanceNodes)
    }
  }
}
