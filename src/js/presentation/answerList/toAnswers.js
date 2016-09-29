const instance = require('../instance')
const toLastOfUrl = require('../toLastOfUrl')

module.exports = function toAnswers(solutions, focus) {
  return solutions.map((solution) => {
    const focusInstanceId = Object.keys(solution)
      .filter(instance.is)
      .find((id) => instance.isNodeId(focus, id))

    return {
      label: toLastOfUrl(solution[focusInstanceId])
    }
  })
}
