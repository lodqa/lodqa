var privateData = {}

module.exports = {
  onAnchoredPgp: function(domId, anchored_pgp) {
    privateData.currentRegion = document.createElement('div')
    privateData.currentRegion.classList.add('section')
    privateData.currentRegion.style.border = 'solid black 1px'
    document.getElementById(domId).appendChild(privateData.currentRegion)
    privateData.currentRegion.innerHTML = JSON.stringify(anchored_pgp)
  },
  onSolution: function(solution) {
    privateData.currentRegion.innerHTML += '<br />' + JSON.stringify(solution)
  }
}
