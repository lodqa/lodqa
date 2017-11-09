module.exports = class {
  constructor(dom, onClick, model, formatter = jsonFormatter) {
    this._dom = dom
    this._formatter = formatter

    this._dom.addEventListener('click', () => onClick(this))

    model.on('answer_index_add_event',() => this.updateLength(model.answerIndex.length))
  }

  updateContent(labelAndUrls) {
    setContent(
      this._dom,
      this._formatter(labelAndUrls)
    )
  }

  updateLength(length) {
    this._dom.querySelector('.answers-length')
      .innerText = `(${length})`
  }
}

function setContent(button, data) {
  button.href = `data:,${encodeURIComponent(data)}`
}

function jsonFormatter(data) {
  return JSON.stringify(data, null, 2)
}
