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
        <h3><span class="answers-region__title__heading">Answers</span></h3>
      </div>
    </div>
    `
    privateData.list = answerList(solutions, privateData.anchoredPgp.focus)
    const list = privateData.list

    privateData.table = solutionTable(solutions)
    const table = privateData.table
    const tableButton = listTableButton(table, list)

    privateData.graph = graph(privateData.anchoredPgp, bgp, solutions)
    const solutionGraph = privateData.graph.dom
    const showGraphButton = graphButton(solutionGraph)

    const element = document.createElement('div')
    element.innerHTML = region

    element.querySelector('.answers-region__title__heading').appendChild(tableButton)
    element.querySelector('.answers-region__title__heading').appendChild(showGraphButton)

    element.children[0].appendChild(list)
    element.children[0].appendChild(table)
    element.children[0].appendChild(solutionGraph)

    // Add a list to the dom tree
    document.querySelector(`#${domId}`)
      .appendChild(element.children[0])
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
