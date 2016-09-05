const appendAnswers = require('./SparqlTablePresentation/appendAnswers')

const regionHtml = `<div class="answer-list-region">
  <h2>Answers</h2>
  <ul class="answer-list"></ul>
</div>
`

const privateData = {}

class AnswerListPresentation {
  onAnchoredPgp(domId, anchored_pgp) {
    privateData.focus = anchored_pgp.focus
  }

  onSolution(data, domId) {
    const {solutions} = data

    if (solutions.length === 0) {
      return
    }

    const $region = $(regionHtml)
    appendAnswers($region, solutions, privateData.focus)

    // Add a list to the dom tree
    $('#' + domId).append($region)
  }
}

module.exports = new AnswerListPresentation
