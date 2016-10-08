const Hogan = require('hogan.js')

const regionHtml = `<div class="sparql-region">
  <div class="sparql-region__title">
    <h2 class="sparql-region__title__heading">Sparql</h2>
    <input class="sparql-region__title__button" type="button" value="Show sparql"></input>
  </div>
  <div class="sparql-region__sparql sparql-region__sparql--hide">
    <textarea>{{sparql}}</textarea>
  </div>
</div>
`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function(sparql) {
  const $html = $(reigonTemplate.render({
    sparql
  }))

  // Activate the show button
  $html
    .on('click', 'input', (e) => {
      $html.find('.sparql-region__sparql')[0].classList.toggle('sparql-region__sparql--hide')

      if (e.target.value === 'Show sparql') {
        e.target.value = 'Hide sparql'
      } else {
        e.target.value = 'Show sparql'
      }
    })

  return $html
}
