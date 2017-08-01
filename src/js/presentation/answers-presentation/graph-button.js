const regionHtml = `
  <input type="button" value="Show graph" class="answers-region__title__button"></input>
`
module.exports = function(target) {
  const element = document.createElement('div')

  element.innerHTML = regionHtml
  element
    .querySelector('input')
    .addEventListener('click', (e) => {
      target.classList.toggle('answers-region__graph--hide')

      if (e.target.value === 'Show graph') {
        e.target.value = 'Hide graph'
      } else {
        e.target.value = 'Show graph'
      }
    })

  return element.children[0]
}
