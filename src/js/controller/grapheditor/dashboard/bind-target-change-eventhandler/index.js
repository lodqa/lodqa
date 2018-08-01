const changeTarget = require('./change-target')
module.exports = function bindTargetChangeEventhandler(editor) {
  // add event listeners
  const selector = document.querySelector('#target')
  if (selector) {
    selector.addEventListener('change', (e) => changeTarget(e.target.value, editor))

    // initial target
    changeTarget(selector.value, editor)
  }
}
