const assert = require('assert')
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
  assert(dom, 'dom is a necessary parameter')
  assert(html.trim(), 'html must have any childNodes')

  const [ast] = parse5.parseFragment(html.trim())
    .childNodes
  diffAndUpdate(ast, dom)
}

function updateChildren(dom, html) {
  assert(dom, 'dom is a necessary parameter')

  const ast = parse5.parseFragment(html.trim())
  diffAndUpdateChildren(ast, dom)
}
