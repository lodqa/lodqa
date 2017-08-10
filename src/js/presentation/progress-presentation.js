module.exports = function(domId) {
  const element = document.getElementById(domId)

  let total = 0
  let recieved = 0

  return {
    show: () => show(element),
    setTotal: (newTotal) => {
      total = newTotal
      showProgress(element, 0, newTotal)
    },
    updateProgress: () => showProgress(element, ++recieved, total),
    hide: () => {
      total = 0
      recieved = 0
      hide(element)
    }
  }
}

function show(element) {
  updateDisplay(element, '<div class="lodqa-message">lodqa running ...<img src="images/working.gif"/></div>')
}

function showProgress(element, count, total) {
  updateDisplay(element, `<div class="lodqa-message">loading ${count} of ${total} <img src="images/working.gif"/></div>`)
}

function hide(element) {
  updateDisplay(element, '')
}

function updateDisplay(el, msg) {
  el.innerHTML = msg
}
