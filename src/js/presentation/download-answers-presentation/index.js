const updateDomTree = require('../update-dom-tree')

module.exports = class {
  constructor(dom, model) {
    model.on('answer_summary_update_event', () => render(dom, model))
  }
}

function render(dom, model) {
  const quantity = model.snapshot.length
  const template = `
  ${quantity} answers are found.
  <a class="download-answers__download-button">download answers</a> in
  <label for="select-format" class="download-answers__select-format-label">
    <select class="download-answers__select-format">
      <option value="json" selected>json</option>
      <option value="tsv">tsv</option>
    </select>
  </label>
  format.
  `
  const html = template
  updateDomTree(dom, html)
}
