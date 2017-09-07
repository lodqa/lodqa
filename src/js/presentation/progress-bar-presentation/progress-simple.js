module.exports = function(progressBarDomId, sparqlCount) {
  const progress = document.querySelector(`#${progressBarDomId} .progress-bar__simple-progress-bar__progress`)

  progress.value = sparqlCount

  document.querySelector('.progress-bar__simple-progress-bar__percentage').innerHTML = `${Math.floor(progress.value / progress.max * 1000) / 10}%`
}
