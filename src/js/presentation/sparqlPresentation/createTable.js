const Hogan = require('hogan.js')

const regionHtml = `<div class="result-region sparql-region hide">
  <h2>Sparql</h2>
  <span class="sparql">{{sparql}}</span>
</div>
<div>
   <input type="button" value="Show sparql"></input>
</div>
`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function(sparql) {
  const $html = $(reigonTemplate.render({
    sparql
  }))

  $html
    .on('click', 'input', (e) => {
      $html[0].classList.toggle('hide')

      if (e.target.value === 'Show sparql') {
        e.target.value = 'Hide sparql'
      } else {
        e.target.value = 'Show sparql'
      }
    })

  return $html
}
