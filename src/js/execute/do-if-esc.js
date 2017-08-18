module.exports = function(handler) {
  return (event) => {
    if (event.key === 'Escape') {
      handler()
    }
  }
}
