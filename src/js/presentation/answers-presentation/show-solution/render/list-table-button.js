const createDom = require('../../../create-dom')

const regionHtml = `
  <input type="button" value="Table" class="answers-region__title__button"></input>
`

module.exports = function(target, target2) {
  const element = createDom(regionHtml)

  element
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

  return element
}
