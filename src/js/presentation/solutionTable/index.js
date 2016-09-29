const Hogan = require('Hogan.js')
const toSolutionRow = require('./toSolutionRow')

const regionHtml = `<div class="result-region solution-region hide">
      <table>
          <tr>
            {{#keys}}
              <th>{{key}}</th>
            {{/keys}}
          </tr>
      </table>
  </div>`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function(solutions) {
  const data = {
    keys: Object.keys(solutions[0])
      .map((key) => ({
        key
      }))
  }
  const $region = $(reigonTemplate.render(data))

  for (const solution of solutions) {
    $region.find('table').append(toSolutionRow(solution))
  }

  return $region
}
