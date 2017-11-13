const findLabel = require('../../../find-label')
const answerList = require('./answer-list')
const solutionTable = require('./solution-table')
const solutionGraph = require('./graph')
const render = require('./render')
const getUniqUrls = require('./get-uniq-urls')

module.exports = function(dom, anchoredPgp, data, findLabelOptions) {
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

  if(findLabelOptions) {
    // This is not good dependency.
    // It is better that the Model has a function of finding labels.
    // But this logic strongly depends on reference of presentattions.
    findLabel(getUniqUrls(solutions), (url, label) => {
      // Update labels in the list, the table and the graph
      [list.updateLabel, table.updateLabel, graph.updateLabel]
        .filter((func) => func)
        .forEach((func) => func(url, label))
    }, findLabelOptions)
  }
}
