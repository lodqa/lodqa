const _ = require('lodash')
const Hogan = require('Hogan.js')
const instance = require('../instance')
const toLastOfUrl = require('../toLastOfUrl')

const listHtml = `<li>{{instance}}</li>`
const instanceTemplate = Hogan.compile(listHtml)

module.exports = function($resultTable, solutions, focus) {
  const currentAnswerList = $resultTable.find('.answer-list')

  for (const solution of solutions) {
    const focusInstanceId = _.first(
        Object.keys(solution)
        .filter(instance.is)
        .filter(_.partial(instance.isNodeId, focus))
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
