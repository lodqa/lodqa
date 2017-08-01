const handlebars = require('handlebars')
const createDom = require('../create-dom')
const toSolutionRow = require('./to-solution-row')

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
const reigonTemplate = handlebars.compile(regionHtml)

module.exports = function(solutions) {
  const data = {
    keys: Object.keys(solutions[0])
      .map((key) => ({
        key
      })),
    solutions: solutions.map(toSolutionRow)
  }
  const dom = createDom(reigonTemplate(data))

  return {
    dom,
    updateLabel(url, label) {
      for (const element of dom.querySelectorAll('a')) {
        if(element.href === url && element.innerText !==label){
          element.innerText = label
        }
      }
    }
  }
}
