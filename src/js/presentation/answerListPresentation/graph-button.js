const Hogan = require('hogan.js')

const regionHtml = `
  <input type="button" value="Show graph" class="answers-region__title__button"></input>
`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function(target) {
  const $region = $(reigonTemplate.render())

  $region
    .on('click', (e) => {
      target.classList.toggle('answers-region__graph--hide')

      if (e.target.value === 'Show graph') {
        e.target.value = 'Hide graph'
      } else {
        e.target.value = 'Show graph'
      }
    })

  return $region
}
