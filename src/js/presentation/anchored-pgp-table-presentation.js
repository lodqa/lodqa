const handlebars = require('handlebars')
const toArray = require('../collection/to-array')
const createDom = require('./create-dom')

const template = handlebars.compile(`
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
`)

module.exports = {
  onAnchoredPgp(domId, anchored_pgp) {
    const nodes = Object.keys(anchored_pgp.nodes)
      .map((node_id) => toViewParameters(anchored_pgp, node_id))
      .reduce(toArray, [])
    const table = template({nodes})
    const element = createDom(table)

    document.querySelector(`#${domId}`).appendChild(element)
  }
}

function toViewParameters(anchored_pgp, node_id) {
  return Object.assign({}, anchored_pgp.nodes[node_id], {
    id: node_id,
    class: node_id === anchored_pgp.focus ? 'focus' : 'normal'
  })
}
