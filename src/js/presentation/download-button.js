module.exports = class {
  constructor(parent, domSelector, onClick, formatter) {
    this._domSelector = domSelector
    this._dom = parent.querySelector(`${this._domSelector}`)
    this._formatter = formatter

    this._dom.addEventListener('click', () => onClick(this))
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
