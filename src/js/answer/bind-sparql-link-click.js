module.exports = function(parent, selectors, handler) {
  for (const selector of selectors) {
    parent.querySelector(`${selector}`)
      .addEventListener('click', (e) => {
        if (e.target.classList.contains('sparql-link')) {
          handler(e.target.getAttribute('data-sparql-number'))
        }
      })
  }
}
