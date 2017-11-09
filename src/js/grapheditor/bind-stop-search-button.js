module.exports = function(loader) {
  const button = document.querySelector('#stopSearch')

  loader
    .on('ws_close', () => {
      document.querySelector('#beginSearch').classList.toggle('hidden')
      document.querySelector('#stopSearch').classList.toggle('hidden')
    })

  button.addEventListener('click', () => loader.stopSearch())
}
