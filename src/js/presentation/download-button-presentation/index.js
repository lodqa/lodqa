const updateDomTree = require('../update-dom-tree')

module.exports = class {
  constructor(dom, model) {
    model.on('answer_summary_update_event', () => render(dom, model))
  }
}

function render(dom, model) {
  const quantity = model.snapshot.length
  const template = `
  <a class="download-buttons__download-json-button" download="answer.json"><i class="fa fa-download" aria-hidden="true"></i> Download JSON (${quantity})</a>
  <a class="download-buttons__download-tsv-button" download="answer.tsv"><i class="fa fa-download" aria-hidden="true"></i> Download TSV (${quantity})</a>
  `
  const html = template
  updateDomTree(dom, html)
}
