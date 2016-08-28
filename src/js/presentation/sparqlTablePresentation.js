const _ = require('lodash')
const instance = require('./instance')
const makeTemplate = require('../render/makeTemplate')
const reigonTemplate = makeTemplate(function() {
  /*
  <div class="result-region">
      <table class="sparql-table">
          <tr>
              <th>sparql</th>
              <th>answer</th>
          </tr>
          <tr>
              <td class="sparql">{{sparql}}</td>
              <td><ul class="answer-list list-in-table"></ul></td>
          </tr>
      </table>
  </div>
  */
})
const instanceTemplate = makeTemplate(function() {
  /*
  <li>{{instance}}</li>
  */
})
const toLastOfUrl = require('./toLastOfUrl')
const privateData = {}

class SparqlTablePresentation {
  onAnchoredPgp(domId, anchored_pgp) {
    privateData.domId = domId
    privateData.focus = anchored_pgp.focus
  }

  onSolution(data) {
    const {sparql, solutions} = data
    const $resultTable = createTable(sparql)
    appendAnswers($resultTable, solutions)

    // Add a table to the dom tree
    $('#' + privateData.domId)
      .append($resultTable)
  }
}

module.exports = new SparqlTablePresentation

function createTable(sparql) {
  const html = reigonTemplate.render({
    sparql
  })

  return $(html)
}

function appendAnswers($resultTable, solutions) {
  const currentAnswerList = $resultTable.find('.answer-list')

  for (const solution of solutions) {
    const focusInstanceId = _.first(
        Object.keys(solution)
        .filter(instance.is)
        .filter(_.partial(instance.isNodeId, privateData.focus))
      ),
      label = toLastOfUrl(solution[focusInstanceId])

    currentAnswerList
      .append(
        instanceTemplate.render({
          instance: label
        })
      )
  }
}
