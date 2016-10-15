const answerList = require('./answerList')
const solutionTable = require('./solutionTable')
const listTableButton = require('./list-table-button')
const graph = require('./graph')
const graphButton = require('./graph-button')

const privateData = {}

class AnswerListPresentation {
  onAnchoredPgp(domId, anchored_pgp) {
    privateData.anchoredPgp = anchored_pgp
  }

  onSolution(data, domId) {
    const {
      bgp,
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
    const list = $(answerList(solutions, privateData.anchoredPgp.focus))
    const table = solutionTable(solutions)
    const tableButton = listTableButton(table[0], list[0])
    const solutionGraph = graph(privateData.anchoredPgp, bgp, solutions)
    const showGraphButton = graphButton(solutionGraph[0])

    const $region = $(region)

    $region
      .find('.answers-region__title')
      .append(tableButton)
      .append(showGraphButton)

    $region
      .append(list)
      .append(table)
      .append(solutionGraph)

    // Add a list to the dom tree
    $(`#${domId}`)
      .append($region)
  }
}

module.exports = new AnswerListPresentation
