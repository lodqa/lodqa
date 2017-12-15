module.exports = class {
  constructor(dom, dataset) {
    this._element = dom
    this._total = 0
    this._recieved = 0

    // Bind Model's events
    const onSparqlAdd = () => {
      this._total = dataset.sparqlsMax
      showProgress(this._element, this._recieved, dataset.sparqlsMax)
    }
    dataset.on('sparql_add_event', onSparqlAdd)

    const onSolutionAdd = () => showProgress(
      this._element,
      ++this._recieved,
      this._total
    )
    dataset.on('solution_add_event', onSolutionAdd)

    const onStateChange = () => {
      if (dataset.progress) {
        show(this._element)
      } else {
        this._total = 0
        this._recieved = 0
        hide(this._element)
      }
    }
    dataset.on('state_change_event', onStateChange)
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
