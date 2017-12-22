module.exports = function(loader) {
  const button = document.querySelector('#stop-search')

  loader
    .on('ws_close', () => {
      document.querySelector('#begin-search').classList.toggle('hidden')
      document.querySelector('#stop-search').classList.toggle('hidden')
    })

  button.addEventListener('click', () => loader.stopSearch())
}
