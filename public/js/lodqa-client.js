window.onload = function() {
  var bindSolution = function(solution, presetation) {
    var data = {},
      domId = 'lodqa-results';

    solution
      .on('anchored_pgp', _.partial(presetation.onAnchoredPgp, domId, data))
      .on('solution', _.partial(presetation.onSolution, data));
  };

  // var solution = lodqaClient.loadSolution();
  var solution = lodqaClient.loadSolutionStub();

  bindSolution(solution, lodqaClient.tablePresentation);
  bindSolution(solution, lodqaClient.graphPresentation);
  bindSolution(solution, lodqaClient.debugPresentation);
}
