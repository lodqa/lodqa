module.exports = function (checkboxDomId, callback){
  document.querySelector(`#${checkboxDomId}`)
    .addEventListener('click', callback)
}
