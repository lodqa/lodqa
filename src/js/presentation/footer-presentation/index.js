const updateDomTree = require('../update-dom-tree')

module.exports = class {
  constructor(dom, model) {
    model.on('footer_update_event', () => render(dom, model))
  }
}

function render(dom, model) {
  const html = template(model.state)
  updateDomTree(dom, html)
}

function template(state) {
  return `
<div class="footer ${state}">
  <div class="footer-upper">
    The LODQA service is provided by Database Center for Life Science.<br>
  </div>
  <div class="footer-lower">
    Comments &amp; suggestions are welcome. Please contact to : support AT dbcls DOT rois DOT ac DOT jp
  </div>
</div>
`
}
