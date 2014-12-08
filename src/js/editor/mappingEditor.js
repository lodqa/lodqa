module.exports = function(mappings) {
  makeTemplate = require('../render/makeTemplate'),
    regionTemplate = makeTemplate(function() {
      /*
      <div class="result-region">
          <table class="mapping-editor-table">
              <tr>
                  <th>node</th>
                  <th>mappings</th>
              </tr>
                  {{#node}}
                  <tr class="mappings-node">
                      <td>{{nade_name}}</td>
                      <td>
                          <ul class="mapping-list list-in-table">
                            {{#mappings}}
                                <li>
                                    <input class="mapping-checkbox" type="checkbox" checked="checked" node="{{nade_name}}" mapping="{{name}}"></input>
                                    {{name}}
                                </li>
                            {{/mappings}}
                          </ul>
                      </td>
                  </tr>
              {{/node}}
          </table>
      </div>
      */
    }),
    dataForTemplate = {
      node: Object.keys(mappings)
        .map(function(key) {
          return {
            nade_name: key,
            mappings: mappings[key].map(function(name) {
              return {
                name: name
              };
            })
          }
        })
    },
    region = regionTemplate.render(dataForTemplate),
    $region = $(region);

  $region.on('change', '.mapping-checkbox', function(e) {
    var $target = $(e.target),
      node = $target.attr('node'),
      mapping = $target.attr('mapping');

    if ($target.is(':checked')) {
      mappings[node] = mappings[node].concat([mapping]);
    } else {
      mappings[node] = mappings[node].filter(function(a) {
        return a !== mapping;
      });
    }
  });

  return $region;
}
