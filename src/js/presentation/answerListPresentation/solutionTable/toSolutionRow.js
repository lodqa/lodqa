const Hogan = require('hogan.js')
const toArray = require('../../../collection/toArray')
const toLastOfUrl = require('../../../toLastOfUrl')

const trHtml = `<tr>
  {{#nodes}}
    <td class="solution">
      <a target="_blank" href="{{url}}" title="{{url}}">{{label}}</a>
    </td>
  {{/nodes}}
</tr>`
const solutionRowTemplate = Hogan.compile(trHtml)

module.exports = function toSolutionRow(solution) {
  const nodes = Object.keys(solution)
    .map((key) => toViewParameters(solution, key))
    .reduce(toArray, [])

  return solutionRowTemplate.render({
    nodes
  })
}

function toViewParameters(solution, key) {
  return {
    id: key,
    url: solution[key],
    label: toLastOfUrl(solution[key])
  }
}
