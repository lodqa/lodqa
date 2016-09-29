const solutionTable = require('../solutionTable')
const button = require('../button')

class SolutionTablePresentation {
  onSolution(data, domId) {
    const {
      solutions
    } = data

    if (solutions.length > 0) {
      const currentSolutionList = solutionTable(solutions)

      $('#' + domId)
        .append(currentSolutionList)

      $('#' + domId)
        .append(button(currentSolutionList[0]))
    }
  }
}

module.exports = new SolutionTablePresentation
