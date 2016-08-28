const instance = require('./instance')
const SolutionGraph = require('../graph/SolutionGraph')

const privateData = {}

class GraphPresentation {
  onAnchoredPgp(domId, anchored_pgp) {
    privateData.domId = domId
    privateData.anchoredPgp = anchored_pgp
    privateData.focus = anchored_pgp.focus
    privateData.edges = anchored_pgp.edges
  }
  onSolution(data) {
    const {
      solutions
    } = data

    if (solutions.length > 0) {
      const graph = new SolutionGraph(privateData.domId, {
        width: 690,
        height: 400
      })

      graph.addAnchoredPgpNodes(privateData.anchoredPgp)

      for (const solution of solutions) {
        const isFocus = (solution) => instance.isNodeId(privateData.focus, solution)
        const instanceNodes = graph.addInstanceNode(isFocus, solution)
        const transitNodes = graph.addTransitNode(solution)

        graph.addPath(solution, privateData.edges, transitNodes, instanceNodes)
      }
    }
  }
}

module.exports = new GraphPresentation
