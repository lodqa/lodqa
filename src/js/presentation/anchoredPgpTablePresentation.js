var _ = require('lodash'),
  makeTemplate = require('./makeTemplate'),
  tableTemplate = makeTemplate(function() {
    /*
    <div class="result-region anchored_pgp-region">
        <table class="anchored_pgp-table">
            <tr>
                <th></th>
                <th>head</th>
                <th>text</th>
                <th>term</th>
            </tr>
            {{{rows}}}
        </table>
    </div>
    */
  }),
  rowTemplate = makeTemplate(function() {
    /*
    <tr class="{{class}}">
        <td>{{id}}</td>
        <td>{{head}}</td>
        <td>{{text}}</td>
        <td>{{term}}</td>
    </tr>
    */
  });

module.exports = {
  onAnchoredPgp: function(domId, anchored_pgp) {
    var rows = Object.keys(anchored_pgp.nodes)
      .map(function(node_id) {
        return _.extend({}, anchored_pgp.nodes[node_id], {
          id: node_id,
          class: node_id === anchored_pgp.focus ? 'focus' : 'normal'
        });
      })
      .map(function(node) {
        return rowTemplate.render(node);
      }),
      table = tableTemplate.render({
        rows: rows.join('')
      });

    $('#' + domId).append(table);
  }
};
