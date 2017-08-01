const createDom = require('./create-dom')
const listTableButton = require('./list-table-button')
const graphButton = require('./graph-button')

const region = `<div class="answers-region">
  <div class="answers-region__title">
    <h3><span class="answers-region__title__heading">Answers</span></h3>
  </div>
</div>
`

module.exports = function(domId, list, table, graph) {
  const element = createDom(region)

  element.appendChild(list.dom)
  element.appendChild(table.dom)
  element.appendChild(graph.dom)

  const tableButton = listTableButton(table.dom, list.dom)
  element.querySelector('.answers-region__title__heading')
    .appendChild(tableButton)

  const showGraphButton = graphButton(graph.dom)
  element.querySelector('.answers-region__title__heading')
    .appendChild(showGraphButton)

  // Add an element to the dom tree
  document.querySelector(`#${domId}`)
    .appendChild(element)
}
