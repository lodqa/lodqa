const instance = require('../../../instance')
const toLastOfUrl = require('../../../to-last-of-url')

module.exports = function toAnswers(solutions, focus) {
  return solutions.map((solution) => {
    const focusInstanceId = instance.getFocusInstanceId(solution, focus)

    return {
      label: toLastOfUrl(solution[focusInstanceId]),
      url: solution[focusInstanceId]
    }
  })
}
