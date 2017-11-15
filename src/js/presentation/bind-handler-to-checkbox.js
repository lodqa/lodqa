module.exports = function (dom, checkboxDomSelector, callback){
  dom.querySelector(`${checkboxDomSelector}`)
    .addEventListener('click', callback)
}
