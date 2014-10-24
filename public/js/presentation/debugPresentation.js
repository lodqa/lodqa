(function() {
  this.lodqaClient = this.lodqaClient || {};
  this.lodqaClient.debugPresentation = {
    onAnchoredPgp: function(domId, data, anchored_pgp) {
      data.currentRegion = document.createElement('div');
      data.currentRegion.classList.add('section');
      data.currentRegion.style.border = "solid black 1px";
      document.getElementById(domId).appendChild(data.currentRegion);
      data.currentRegion.innerHTML = JSON.stringify(anchored_pgp);
    },
    onSolution: function(data, solution) {
      data.currentRegion.innerHTML += '<br />' + JSON.stringify(solution);
    }
  };
}.call(this));
