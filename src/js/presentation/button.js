const Hogan = require('Hogan.js')

const regionHtml = `<div>
     <input type="button" value="Show solutions in table"></input>
  </div>`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function SolutionLsit(target) {
  const $region = $(reigonTemplate.render())

  $region
    .on('click', 'input', (e) => {
      target.classList.toggle('hide')

      if (e.target.val === 'Show solutions in table') {
        e.target.val = 'Hide solutions in table'
      } else {
        e.target.val = 'Show solutions in table'
      }
    })

  return $region
}
