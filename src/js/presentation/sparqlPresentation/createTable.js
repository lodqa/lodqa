const Hogan = require('hogan.js')

const regionHtml = `<div class="sparql-region">
  <div class="sparql-region__title">
    <h2 class="sparql-region__title__heading">
      Sparql {{count}}
      <input class="sparql-region__title__button" type="button" value="Show"></input>
    </h2>
  </div>
  <div class="sparql-region__sparql sparql-region__sparql--hide">
    <textarea>{{sparql}}</textarea>
  </div>
</div>
`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function(sparql, count) {
  const $html = $(reigonTemplate.render({
    sparql,
    count
  }))

  // Activate the show button
  $html
    .on('click', 'input', (e) => {
      $html.find('.sparql-region__sparql')[0].classList.toggle('sparql-region__sparql--hide')

      if (e.target.value === 'Show') {
        e.target.value = 'Hide'
      } else {
        e.target.value = 'Show'
      }
    })

  return $html
}
