const parse5 = require('parse5')
const diffAndUpdate = require('./diff-and-update')

module.exports = function update(dom, html) {
  const ast = parse5.parseFragment(html)
  diffAndUpdate(ast, dom)
}
