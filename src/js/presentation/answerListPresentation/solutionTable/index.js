const Hogan = require('hogan.js')
const toSolutionRow = require('./toSolutionRow')

const regionHtml = `<div class="answers-region__answers-table answers-region__answers-table--hide">
      <table>
          <tr>
            {{#keys}}
              <th>{{key}}</th>
            {{/keys}}
          </tr>
          {{#solutions}}
          <tr>
            {{#nodes}}
              <td class="solution">
                <a target="_blank" href="{{url}}" title="{{url}}">{{label}}</a>
              </td>
            {{/nodes}}
          </tr>
          {{/solutions}}
      </table>
  </div>`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function(solutions) {
  const data = {
    keys: Object.keys(solutions[0])
      .map((key) => ({
        key
      })),
    solutions: solutions.map(toSolutionRow)
  }
  const element = document.createElement('div')

  element.innerHTML = reigonTemplate.render(data)

  return element.children[0]
}
