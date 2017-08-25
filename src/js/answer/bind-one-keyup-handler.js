let previousHandler = null

// Bind a handler to key up events.
// If the previous handler was bound, unbind it.
module.exports = function(func) {
  if (previousHandler) {
    document.body.removeEventListener('keyup', previousHandler)
  }

  document.body.addEventListener('keyup', func)
  previousHandler = func
}
