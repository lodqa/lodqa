var _ = require('lodash'),
  makeTemplate = require('../render/makeTemplate'),
  template = makeTemplate(function() {
    /*
    <div class="result-region anchored_pgp-region">
        <table class="anchored_pgp-table">
            <tr>
                <th></th>
                <th>head</th>
                <th>text</th>
                <th>term</th>
            </tr>
            {{#nodes}}
            <tr class="{{class}}">
                <td>{{id}}</td>
                <td>{{head}}</td>
                <td>{{text}}</td>
                <td>{{term}}</td>
            </tr>
            {{/nodes}}
        </table>
    </div>
    */
  }),
  toViewParameters = function(anchored_pgp, node_id) {
    return _.extend({}, anchored_pgp.nodes[node_id], {
      id: node_id,
      class: node_id === anchored_pgp.focus ? 'focus' : 'normal'
    });
  },
  toArray = require('../collection/toArray');

module.exports = {
  onAnchoredPgp: function(domId, anchored_pgp) {
    var toParams = _.partial(toViewParameters, anchored_pgp),
      nodes = Object.keys(anchored_pgp.nodes)
      .map(toParams)
      .reduce(toArray, []),
      table = template.render({
        nodes: nodes
      });

    $('#' + domId).append(table);
  }
};
