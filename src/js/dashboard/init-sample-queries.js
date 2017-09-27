module.exports = function() {
  // sample queries
  document.querySelector('#button-show-queries')
    .addEventListener('click', (e) => {
      e.stopPropagation()
      const element = document.querySelector('.examples')
      if (element) {
        element.classList.toggle('examples--hidden')
      }
    })

  const queries = document.querySelector('.sample-queries')
  if (queries) {
    queries.addEventListener('click', (e) => {
      const element = document.querySelector('.examples')
      if (element) {
        element.classList.add('examples--hidden')
      }
    })
  }
}
