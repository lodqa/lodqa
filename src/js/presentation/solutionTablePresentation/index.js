const SolutionLsit = require('./SolutionLsit')
const toSolutionRow = require('./toSolutionRow')

class SolutionTablePresentation {
  onSolution(data, domId) {
    const {
      solutions
    } = data

    if (solutions.length > 0) {
      const currentSolutionList = new SolutionLsit(domId, solutions[0])

      for (const solution of solutions) {
        currentSolutionList.append(toSolutionRow(solution))
      }
    }
  }
}

module.exports = new SolutionTablePresentation
