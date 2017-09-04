module.exports = function() {
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
