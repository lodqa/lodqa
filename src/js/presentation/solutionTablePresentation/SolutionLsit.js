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
  var $region = $(reigonHtml)
    .on('click', 'input', function(event) {
      $region[0].classList.toggle('hide')

      var $input = $(event.target)
      if ($input.val() === 'Show solutions in table') {
        $input.val('Hide solutions in table')
      } else {
        $input.val('Show solutions in table')
      }
    })

  $('#' + domId)
    .append($region)

  return $region.find('table')
}
