module.exports = function(domId) {
  const dom = document.getElementById(domId)

  let hoge = 0
  let fuga = 0

  return {
    onOpen: () => show(dom),
    onSparqlCount: (total) => {
      hoge = total
      showProgress(dom, 0, total)
    },
    onSolution: () => showProgress(dom, ++fuga, hoge),
    onClose: () => {
      hoge = 0
      fuga = 0
      hide(dom)
    }
  }
}

function show(dom) {
  updateDisplay(dom, '<div class="lodqa-message">lodqa running ...<img src="images/working.gif"/></div>')
}

function showProgress(dom, count, total) {
  updateDisplay(dom, `<div class="lodqa-message">loading ${count} of ${total} <img src="images/working.gif"/></div>`)
}

function hide(dom) {
  updateDisplay(dom, '')
}

function updateDisplay(el, msg) {
  el.innerHTML = msg
}
