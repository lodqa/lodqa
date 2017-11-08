module.exports = class {
  constructor(dom, onClick, formatter = defaultFormatter) {
    this._dom = dom
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

function defaultFormatter(data) {
  return JSON.stringify(data, null, 2)
}
