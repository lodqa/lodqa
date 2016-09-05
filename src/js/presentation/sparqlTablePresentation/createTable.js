const Hogan = require('hogan.js')

const regionHtml = `<div class="result-region">
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
`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function(sparql) {
  const html = reigonTemplate.render({
    sparql
  })

  return $(html)
}
