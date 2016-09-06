const Hogan = require('hogan.js')

const regionHtml = `<div class="result-region sparql-region">
  <h2>Sparql</h2>
  <span class="sparql">{{sparql}}</span>
</div>
`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function(sparql) {
  const html = reigonTemplate.render({
    sparql
  })

  return $(html)
}
