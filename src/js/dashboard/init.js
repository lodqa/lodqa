const initGrpahEditor = require('./init-grpah-editor')
const changeTarget = require('./change-target')

module.exports = function() {
  initSampleQueries()
  bindSearchButtonEventhandler()

  const editor = initGrpahEditor()
  bindTargetChangeEventhandler(editor)
}

function initSampleQueries() {
  // sample queries
  document.querySelector('#button-show-queries')
    .addEventListener('click', (e) => {
      e.stopPropagation()
      const element = document.querySelector('.examples')
      if (element.classList.contains('examples--hidden')) {
        element.classList.remove('examples--hidden')
      } else {
        element.classList.add('examples--hidden')
      }
    })

  document.querySelector('.sample-queries')
    .addEventListener('click', (e) => {
      document.querySelector('#query')
        .value = e.target.text
      document.querySelector('.examples')
        .classList.add('examples--hidden')
    })
}

function bindSearchButtonEventhandler() {
  document.querySelector('#execute-button')
    .addEventListener('click', (e) => {
      // Do not submit form.
      e.preventDefault()

      const form = document.querySelector('#nlqform')

      location.href = `/execute?query=${encodeURIComponent(form.query.value)}&target=${form.target.value}`
    })
}

function bindTargetChangeEventhandler(editor) {
  // add event listeners
  const selector = document.querySelector('#target')
  selector.addEventListener('change', (e) => changeTarget(e.target.value, editor))

  // initial target
  changeTarget(selector.value, editor)
}
