const handlebars = require('handlebars')
const createDom = require('../create-dom')

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
const reigonTemplate = handlebars.compile(regionHtml)

module.exports = function(sparql, count) {
  const element = createDom(reigonTemplate({
    sparql,
    count
  }))

  // Activate the show button
  element
    .querySelector('input')
    .addEventListener('click', (e) => {
      e.target
        .closest('.sparql-region')
        .querySelector('.sparql-region__sparql')
        .classList
        .toggle('sparql-region__sparql--hide')

      if (e.target.value === 'Show') {
        e.target.value = 'Hide'
      } else {
        e.target.value = 'Show'
      }
    })

  return element
}
