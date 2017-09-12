module.exports = function() {
  // sample queries
  document.querySelector('#button-show-queries')
    .addEventListener('click', (e) => {
      e.stopPropagation()
      const element = document.querySelector('.examples')
      if (element) {
        if (element.classList.contains('examples--hidden')) {
          element.classList.remove('examples--hidden')
        } else {
          element.classList.add('examples--hidden')
        }
      }
    })

  const queries = document.querySelector('.sample-queries')
  if (queries) {
    queries.addEventListener('click', (e) => {
      document.querySelector('#query')
        .value = e.target.text
      const element = document.querySelector('.examples')
      if (element) {
        element.classList.add('examples--hidden')
      }
    })
  }
}
