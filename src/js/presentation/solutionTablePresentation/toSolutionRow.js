const _ = require('lodash')
const Hogan = require('hogan.js')
const toArray = require('../../collection/toArray')
const toLastOfUrl = require('../toLastOfUrl')

const trHtml = `<tr>
    <td class="solution">{{#solutions}}{{id}}: <a target="_blank" href="{{url}}" title="{{url}}">{{label}}</a>{{/solutions}}</td>
</tr>`
const solutionRowTemplate = Hogan.compile(trHtml)

module.exports = function toSolutionRow(solution) {
  var toParams = _.partial(toViewParameters, solution),
    solutionLinks = Object.keys(solution)
    .map(toParams)
    .reduce(toArray, [])

  return solutionRowTemplate.render({
    solutions: solutionLinks
  })
}

function toViewParameters(solution, key) {
  return {
    id: key,
    url: solution[key],
    label: toLastOfUrl(solution[key])
  }
}
