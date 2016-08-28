module.exports = function(domId) {
  const onOpen = () => show(document.getElementById(domId), '<div class="lodqa-message">lodqa running ...<img src="images/working.gif"/></div>'),
    onClose = () => show(document.getElementById(domId), '')

  return {
    onOpen,
    onClose
  }
}

function show(el, msg) {
  el.innerHTML = msg
}
