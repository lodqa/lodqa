module.exports = function(dom, sparqlCount) {
  const progress = dom.querySelector('.progress-bar__simple-progress-bar__progress')

  progress.value = sparqlCount

  dom.querySelector('.progress-bar__simple-progress-bar__percentage').innerHTML = `${Math.floor(progress.value / progress.max * 1000) / 10}%`
}
