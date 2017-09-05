module.exports = function(progressBarDomId, sparqlCount) {
  const progress = document.querySelector(`#${progressBarDomId} .simple-progress-bar progress`)

  progress.value = sparqlCount

  document.querySelector('#simple-progress-bar__percentage').innerHTML = `${Math.floor(progress.value / progress.max * 1000) / 10}%`
}
