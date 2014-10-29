var _ = require('lodash');

module.exports = {
  onAnchoredPgp: function(domId, data, anchored_pgp) {
    var $region = $('<div>'),
      $table = $('<table>');

    $region
      .addClass('anchored_pgp-table')
      .append($table);

    $table
      .append(
        $('<tr>')
        .append($('<th>'))
        .append($('<th>').text('head'))
        .append($('<th>').text('text'))
        .append($('<th>').text('term'))
      );

    Object.keys(anchored_pgp.nodes)
      .map(function(node_id) {
        var node = anchored_pgp.nodes[node_id],
          $tr = $('<tr>')
          .append($('<td>').text(node_id))
          .append($('<td>').text(node.head))
          .append($('<td>').text(node.text))
          .append($('<td>').text(node.term));

        if (node_id === anchored_pgp.focus) {
          $tr.addClass('focus');
        }

        return $tr;
      })
      .forEach(function($tr) {
        $table.append($tr);
      });

    $('#' + domId).append($region);
  },
  onSolution: _.noop
};
