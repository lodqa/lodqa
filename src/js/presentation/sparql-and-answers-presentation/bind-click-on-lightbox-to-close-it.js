module.exports = function(lightboxDomId) {
  document.querySelector(`#${lightboxDomId}`)
    .addEventListener('click', (e) => {
      if (e.target.closest('.content')) {
        return
      }
      e.target.closest(`#${lightboxDomId}`)
        .classList.add('hidden')
    })
}
