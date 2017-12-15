module.exports = function(dom, value) {
  const progress = dom.querySelector('.progress-bar__simple-progress-bar__progress')

  progress.max = value

  dom.querySelector('.progress-bar__simple-progress-bar__percentage').innerHTML = `${Math.floor(progress.value / progress.max * 1000) / 10}%`
}
