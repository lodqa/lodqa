const toTerm = require('./to-term')
const toLabelAndSetFontNormal = require('./to-label-and-set-font-normal')

module.exports = function addTransitNode(graph, solution) {
  return Object.keys(solution)
    .filter((id) => id[0] === 'x')
    .map((id) => toTerm(solution, id))
    .map(toLabelAndSetFontNormal)
    .reduce((result, term) => {
      result[term.id] = graph.newNode(term)

      return result
    }, {})
}
