const appendAnswers = require('../answerList')

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

    const region = `<div class="answer-list-region">
      <h2>Answers</h2>
      ${appendAnswers(solutions, privateData.focus)}
    </div>
    `

    // Add a list to the dom tree
    $(`#${domId}`)
      .append($(region))
  }
}

module.exports = new AnswerListPresentation
