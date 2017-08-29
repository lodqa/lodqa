module.exports = class {
  constructor(domId, onClick) {
    this._domId = domId
    this._dom = document.querySelector(`#${this._domId}`)

    this._dom.addEventListener('click', () => onClick(this))
  }

  updateContent(answers) {
    setContent(
      this._dom,
      encodeURIComponent(JSON.stringify(answers.map((s) => ({
        label: s.label,
        url: s.url
      })), null, 2))
    )
  }

  updateLength(length) {
    this._dom.querySelector('.answers-length').innerText = `(${length})`
  }
}

function setContent(button, data) {
  button.href = `data:,${data}`
}
