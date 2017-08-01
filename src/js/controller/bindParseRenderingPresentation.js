module.exports = function(loader) {
  loader.on('parse_rendering', (data) => {
    document.getElementById('lodqa-parse_rendering').innerHTML = data
  })
}
