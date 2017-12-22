const search = require('./search')

module.exports = function(beginSearch, loader, pgpElement, mappingsElement) {
  beginSearch
    .addEventListener('click', (e) => {
      e.target.classList.toggle('hidden')
      document.querySelector('#stop-search')
        .classList.toggle('hidden')
      document.querySelector('.dashboard')
        .classList.add('dashboard--back')
      document.querySelector('.results')
        .classList.remove('results--hidden', 'results--back')
      document.querySelector('.results')
        .classList.remove('results--back')
      e.stopPropagation()

      search(e, loader, pgpElement, mappingsElement)
    })
}
