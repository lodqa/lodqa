var _ = require('lodash'),
  instance = require('./instance'),
  makeTemplate = require('../render/makeTemplate'),
  reigonTemplate = makeTemplate(function() {
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
  }),
  instanceTemplate = makeTemplate(function() {
    /*
    <li>{{instance}}</li>
    */
  }),
  toLastOfUrl = require('./toLastOfUrl'),
  privateData = {}

module.exports = {
  onAnchoredPgp(domId, anchored_pgp) {
    privateData.domId = domId
    privateData.focus = anchored_pgp.focus
  },
  onSolution(data) {
    const {sparql, solutions} = data
    const $resultTable = createTable(sparql)
    appendAnswers($resultTable, solutions)

    // Add a table to the dom tree
    $('#' + privateData.domId)
      .append($resultTable)
  }
}

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
