module.exports = function() {
  // Show or hide sample queries when the button is clicked.
  document.querySelector('#button-show-queries')
    .addEventListener('click', (e) => {
      e.stopPropagation()
      const element = document.querySelector('.examples')
      if (element) {
        element.classList.toggle('examples--hidden')
      }
    })

  // Hide sample queries when it is clicked.
  const queries = document.querySelector('.sample-queries')
  if (queries) {
    queries.addEventListener('click', () => {
      const element = document.querySelector('.examples')
      if (element) {
        element.classList.add('examples--hidden')
      }
    })
  }
}
