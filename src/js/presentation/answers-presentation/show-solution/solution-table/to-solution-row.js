const toArray = require('../../../../collection/to-array')
const toLastOfUrl = require('../../../../to-last-of-url')

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
