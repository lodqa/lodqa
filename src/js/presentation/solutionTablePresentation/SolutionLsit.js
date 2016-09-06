const reigonHtml = `<div class="result-region solution-region hide">
      <table>
          <tr>
              <th>solutions</th>
          </tr>
      </table>
  </div>
  <div>
     <input type="button" value="Show solutions in table"></input>
  </div>`

module.exports = function SolutionLsit(domId) {
  const $region = $(reigonHtml)

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
