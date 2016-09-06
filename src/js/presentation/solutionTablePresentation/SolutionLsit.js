const Hogan = require('Hogan.js')

const regionHtml = `<div class="result-region solution-region hide">
      <table>
          <tr>
            {{#keys}}
              <th>{{key}}</th>
            {{/keys}}
          </tr>
      </table>
  </div>
  <div>
     <input type="button" value="Show solutions in table"></input>
  </div>`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function SolutionLsit(domId, solution) {
  const data = {
    keys: Object.keys(solution)
      .map((key) => ({
        key
      }))
  }
  const $region = $(reigonTemplate.render(data))

  $region
    .on('click', 'input', (e) => {
      $region[0].classList.toggle('hide')

      if (e.target.val === 'Show solutions in table') {
        e.target.val = 'Hide solutions in table'
      } else {
        e.target.val = 'Show solutions in table'
      }
    })

  $('#' + domId)
    .append($region)

  return $region.find('table')
}
