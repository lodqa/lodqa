const answerList = require('./answer-list')
const solutionTable = require('./solution-table')
const solutionGraph = require('./graph')
const render = require('./render')

module.exports = function(dom, anchoredPgp, data) {
  const {
    bgp,
    solutions
  } = data

  if (solutions.length === 0) {
    return
  }

  const list = answerList(solutions, anchoredPgp.focus)
  const table = solutionTable(solutions)
  const graph = solutionGraph(anchoredPgp, bgp, solutions)

  render(dom, list, table, graph)
  return [list, table, graph]
}
