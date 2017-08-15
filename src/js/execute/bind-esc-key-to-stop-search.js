module.exports = function(loader) {
  document.body.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
      loader.stopSearch()
    }
  })
}
