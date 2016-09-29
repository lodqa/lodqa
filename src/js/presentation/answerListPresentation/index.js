const appendAnswers = require('../answerList')
const solutionTable = require('../solutionTable')
const button = require('../button')

const privateData = {}

class AnswerListPresentation {
  onAnchoredPgp(domId, anchored_pgp) {
    privateData.focus = anchored_pgp.focus
  }

  onSolution(data, domId) {
    const {
      solutions
    } = data

    if (solutions.length === 0) {
      return
    }

    const region = `<div class="answers-region">
      <div class="answers-region__title">
        <h3 class="answers-region__title__heading">Answers</h3>
      </div>
    </div>
    `
    const list = $(appendAnswers(solutions, privateData.focus))
    const table = solutionTable(solutions)
    const tableButton = button(table[0], list[0])

    const $region = $(region)

    $region
      .find('.answers-region__title')
      .append(tableButton)

    $region
      .append(list)
      .append(table)

    // Add a list to the dom tree
    $(`#${domId}`)
      .append($region)
  }
}

module.exports = new AnswerListPresentation
