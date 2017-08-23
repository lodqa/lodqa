module.exports = function(lightboxDomId, close) {
  document.querySelector(`#${lightboxDomId}`)
    .addEventListener('click', (e) => {
      if (e.target.closest('.content')) {
        return
      }
      close()
    })
}
