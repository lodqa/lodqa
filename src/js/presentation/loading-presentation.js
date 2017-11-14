module.exports = class {
  constructor(dom, model) {
    this._element = dom
    this._total = 0
    this._recieved = 0

    // Bind Model's events
    const onSparqlReset = () => {
      this._total = model.sparqlsMax
      showProgress(this._element, 0, model.sparqlsMax)
    }
    const onSolutionAdd = () => showProgress(
      this._element,
      ++this._recieved,
      this._total
    )
    model.on('sparql_reset_event', onSparqlReset)
    model.on('solution_add_event', onSolutionAdd)
    model.on('ws_open', () => this.show())
    model.on('ws_close', () => this.hide())
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
