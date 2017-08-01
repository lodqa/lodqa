const answerList = require('./answer-list')
const solutionTable = require('./solution-table')
const solutionGraph = require('./graph')
const render = require('./render')

const privateData = {}

class AnswersPresentation {
  onAnchoredPgp(domId, anchored_pgp) {
    privateData.anchoredPgp = anchored_pgp
  }

  onSolution(domId, data) {
    const {
      bgp,
      solutions
    } = data

    if (solutions.length === 0) {
      return
    }

    const list = answerList(solutions, privateData.anchoredPgp.focus)
    const table = solutionTable(solutions)
    const graph = solutionGraph(privateData.anchoredPgp, bgp, solutions)

    render(domId, list, table, graph)

    // Set privateData for the updateLabel function
    privateData.updateLabel = {
      list: list.updateLabel,
      table: table.updateLabel,
      graph: graph.updateLabel
    }
  }

  updateLabel(url, label) {
    // Update labels in the list, the table and the graph
    for (const func of Object.values(privateData.updateLabel)) {
      if (func) {
        func(url, label)
      }
    }
  }
}

module.exports = new AnswersPresentation
