module.exports = class {
  constructor(domId, model) {
    this._element = document.getElementById(domId)
    this._total = 0
    this._recieved = 0

    model.on('sparql_reset_event', (sparqls) => this.setTotal(sparqls.length))
    model.on('solution_add_event', () => this.updateProgress())
  }

  show() {
    show(this._element)
  }

  setTotal(newTotal) {
    this._total = newTotal
    showProgress(this._element, 0, newTotal)
  }

  updateProgress() {
    showProgress(this._element, ++this._recieved, this._total)
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
