const toArray = require('../../../collection/toArray')
const toLastOfUrl = require('../../../toLastOfUrl')

module.exports = function(solution) {
  const nodes = Object.keys(solution)
    .map((key) => toViewParameters(solution, key))
    .reduce(toArray, [])

  return {
    nodes
  }
}

function toViewParameters(solution, key) {
  return {
    id: key,
    url: solution[key],
    label: toLastOfUrl(solution[key])
  }
}
