const Hogan = require('hogan.js')

const regionHtml = `
  <input type="button" value="Table" class="answers-region__title__button"></input>
`
const reigonTemplate = Hogan.compile(regionHtml)

module.exports = function(target, target2) {
  const element = document.createElement('div')
  element.innerHTML = reigonTemplate.render()

  element
    .querySelector('input')
    .addEventListener('click', (e) => {
      target.classList.toggle('answers-region__answers-table--hide')

      if(target2){
        target2.classList.toggle('answers-region__answers-list--hide')
      }

      if (e.target.value === 'Table') {
        e.target.value = 'List'
      } else {
        e.target.value = 'Table'
      }
    })

  return element.children[0]
}
