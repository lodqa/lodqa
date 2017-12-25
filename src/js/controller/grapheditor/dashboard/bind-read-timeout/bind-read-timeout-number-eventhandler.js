module.exports = function(callback) {
  document.querySelector('#read-timeout')
    .addEventListener('change', (e) => {
      callback(e.target.value)
    })
}
