const answerList = require('./answerList')
const solutionTable = require('./solutionTable')
const listTableButton = require('./list-table-button')
const answerGraph = require('./graph')
const graphButton = require('./graph-button')

const privateData = {}

class AnswerListPresentation {
  onAnchoredPgp(domId, anchored_pgp) {
    privateData.anchoredPgp = anchored_pgp
  }

  onSolution(domId, data) {
    const {
      bgp,
      solutions
    } = data

    if (solutions.length === 0) {
      return
    }

    const region = `<div class="answers-region">
      <div class="answers-region__title">
        <h3><span class="answers-region__title__heading">Answers</span></h3>
      </div>
    </div>
    `
    const element = document.createElement('div')
    element.innerHTML = region

    const list = answerList(solutions, privateData.anchoredPgp.focus)
    element.children[0].appendChild(list)

    const table = solutionTable(solutions)
    element.children[0].appendChild(table)

    const graph = answerGraph(privateData.anchoredPgp, bgp, solutions)
    element.children[0].appendChild(graph)

    const tableButton = listTableButton(table, list)
    element.querySelector('.answers-region__title__heading').appendChild(tableButton)

    const showGraphButton = graphButton(graph)
    element.querySelector('.answers-region__title__heading').appendChild(showGraphButton)

    // Add a list to the dom tree
    document.querySelector(`#${domId}`)
      .appendChild(element.children[0])

    // Set privateData for the updateLabel function
    privateData.list = list
    privateData.table = table
    privateData.graph = graph
  }

  updateLabel(url, label) {
    // Update labels in the list
    if (privateData.list) {
      for (const element of privateData.list.querySelectorAll('a')) {
        if(element.href === url && element.innerText !==label){
          element.innerText = label
        }
      }
    }

    // Update labels in the table
    if (privateData.table) {
      for (const element of privateData.table.querySelectorAll('a')) {
        if(element.href === url && element.innerText !==label){
          element.innerText = label
        }
      }
    }

    // Update labels in the graph
    if (privateData.graph) {
      privateData.graph.updateLabel(url, label)
    }
  }
}

module.exports = new AnswerListPresentation
