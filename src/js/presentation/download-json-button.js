module.exports = class {
  constructor(domId, onClick) {
    this._domId = domId
    document.querySelector(`#${this._domId}`)
      .addEventListener('click', () => onClick(this))
  }

  set content(data){
    document.querySelector(`#${this._domId}`)
      .href = `data:,${data}`
  }
}
