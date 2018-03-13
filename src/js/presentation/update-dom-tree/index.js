const assert = require('assert')
const parse5 = require('parse5')
const diffAndUpdateChildren = require('./diff-and-update-children')

module.exports = function updateChildren(dom, html) {
  assert(dom, 'dom is a necessary parameter')
  assert(html.length < 1000000, 'stop rendering because html length is more than one million.')

  if (html.length > 100000) {
    console.warn(`html is too long: ${html.replace(/[\n\r]+/g, '').replace(/\s{2,10}/g, ' ').substr(0, 100)}`)
  }

  const ast = parse5.parseFragment(html.trim())
  diffAndUpdateChildren(ast, dom)
}
