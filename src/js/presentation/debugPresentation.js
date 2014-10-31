module.exports = {
  onAnchoredPgp: function(domId, data, anchored_pgp) {
    data.currentRegion = document.createElement('div');
    data.currentRegion.classList.add('section');
    data.currentRegion.style.border = "solid black 1px";
    document.getElementById(domId).appendChild(data.currentRegion);
    data.currentRegion.innerHTML = JSON.stringify(anchored_pgp);
  },
  onSparql: function(data, sparql) {
    data.currentRegion.innerHTML += '<br />' + JSON.stringify(sparql);
  },
  onSolution: function(data, solution) {
    data.currentRegion.innerHTML += '<br />' + JSON.stringify(solution);
  }
};
