const instance = require('../../../instance')
const toLastOfUrl = require('../../../to-last-of-url')

module.exports = function toAnswers(solutions, focus) {
  return solutions.map((solution) => {
    const focusInstanceId = Object.keys(solution)
      .filter(instance.is)
      .find((id) => instance.isNodeId(focus, id))

    return {
      label: toLastOfUrl(solution[focusInstanceId]),
      url: solution[focusInstanceId]
    }
  })
}
