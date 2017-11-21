module.exports = function(dom, checkboxDomSelector, callback) {
  dom.addEventListener('click', (e) => {
    if (e.target.closest(checkboxDomSelector)) {
      callback(e)
    }
  })
}
