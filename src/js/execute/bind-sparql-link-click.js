module.exports = function(ids, handler) {
  for (const id of ids) {
    document.querySelector(`#${id}`)
      .addEventListener('click', (e) => {
        if (e.target.classList.contains('sparql-link')) {
          handler(e.target.getAttribute('data-sparql-number'))
        }
      })
  }
}
