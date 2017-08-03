module.exports = function(loader) {
  const button = document.querySelector('#stopSearch')

  loader.eventEmitter
    // .on('ws_open', () => button.disabled = false)
    .on('ws_close', () => {
      document.querySelector('#beginSearch').classList.toggle('hidden')
      document.querySelector('#stopSearch').classList.toggle('hidden')
    })

  button.addEventListener('click', () => loader.stopSearch())
}
