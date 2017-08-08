/* global graphEditor */
module.exports = function() {
  const editor = graphEditor('/termfinder')

  // init graph
  editor.addPgp(JSON.parse(document.querySelector('#lodqa-pgp')
    .innerHTML))

  return editor
}
