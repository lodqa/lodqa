module.exports = function(callback) {
  document.querySelector('#read_timeout')
    .addEventListener('change', (e) => {
      callback(e.target.value)
    })
}
