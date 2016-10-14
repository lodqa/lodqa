const toTerm = require('./toTerm')
const toLabelAndSetFontNormal = require('./toLabelAndSetFontNormal')

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
