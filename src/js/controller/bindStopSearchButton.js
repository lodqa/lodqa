module.exports = function(loader) {
  const button = document.querySelector('#sotpSearch')

  loader
    .on('ws_open', () => button.disabled = false)
    .on('ws_close', () => button.disabled = true)

  button.addEventListener('click', () => loader.stopSearch())
}
