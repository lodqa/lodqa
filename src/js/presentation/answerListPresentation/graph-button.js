const Hogan = require('Hogan.js')

const regionHtml = `
  <input type="button" value="show graph" class="answers-region__title__button"></input>
`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function(target) {
  const $region = $(reigonTemplate.render())

  $region
    .on('click', (e) => {
      target.classList.toggle('answers-region__graph--hide')

      if (e.target.value === 'show graph') {
        e.target.value = 'hide graph'
      } else {
        e.target.value = 'show graph'
      }
    })

  return $region
}
