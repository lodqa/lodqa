const parse5 = require('parse5')
const {
  diffAndUpdate,
  diffAndUpdateChildren
} = require('./diff-and-update')

module.exports = {
  updateDom,
  updateChildren
}

function updateDom(dom, html) {
  const [ast] = parse5.parseFragment(html.trim())
    .childNodes
  diffAndUpdate(ast, dom)
}

function updateChildren(dom, html) {
  const ast = parse5.parseFragment(html.trim())
  diffAndUpdateChildren(ast, dom)
}
