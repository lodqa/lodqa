var _ = require('lodash'),
  instance = require('./instance'),
  privateData = {};

module.exports = {
  onAnchoredPgp: function(domId, anchored_pgp) {
    privateData.domId = domId;
    privateData.focus = anchored_pgp.focus;
  },
  onSparql: function(sparql) {
    var $region = $('<div>'),
      $table = $('<table>');

    $region
      .addClass('sparql-table')
      .append($table);

    privateData.currentInstances = $('<ul>');

    $table
      .append(
        $('<tr>')
        .append($('<th>').text('sparql'))
        .append($('<th>').text('instances'))
        .append($('<th>').text('graph'))
      )
      .append(
        $('<tr>')
        .append($('<td>').text(sparql))
        .append($('<td>').append(privateData.currentInstances))
        .append($('<td>'))
      );

    $('#' + privateData.domId).append($region);
  },
  onSolution: function(solution) {
    var focusInstanceId = _.first(
      Object.keys(solution)
      .filter(instance.is)
      .filter(_.partial(instance.isNodeId, privateData.focus))
    );

    privateData.currentInstances.append($('<li>').text(solution[focusInstanceId]))
  }
};
