module.exports = class {
  constructor(domId, model) {
    this._element = document.getElementById(domId)
    this._total = 0
    this._recieved = 0

    const onSparqlReset = (sparqls) => {
      this._total = sparqls.length
      showProgress(this._element, 0, sparqls.length)
    }
    const onSolutionAdd = () => showProgress(
      this._element,
      ++this._recieved,
      this._total
    )

    model.on('sparql_reset_event', onSparqlReset)
    model.on('solution_add_event', onSolutionAdd)
  }

  show() {
    show(this._element)
  }

  hide() {
    this._total = 0
    this._recieved = 0
    hide(this._element)
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
