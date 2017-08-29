module.exports = class {
  constructor(domId, onClick, formatter) {
    this._domId = domId
    this._dom = document.querySelector(`#${this._domId}`)
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
