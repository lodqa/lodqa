const answerList = require('./answer-list')
const solutionTable = require('./solution-table')
const solutionGraph = require('./graph')
const render = require('./render')
const LabelFinder = require('./label-finder')

const privateData = {}

class AnswersPresentation {
  setAnchoredPgp(domId, anchored_pgp) {
    privateData.anchoredPgp = anchored_pgp
  }

  showSolution(domId, data) {
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

    new LabelFinder().find(data.solutions, (url, label) => {
      // Update labels in the list, the table and the graph
      [list.updateLabel, table.updateLabel, graph.updateLabel]
        .filter((func) => func)
        .forEach((func) => func(url, label))
    })
  }
}

module.exports = new AnswersPresentation
