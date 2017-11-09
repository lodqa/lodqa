const createTable = require('./create-table')
const createDom = require('../create-dom')

module.exports = class {
  constructor(resultDomId, isVerbose, model) {
    model.on('solution_add_event',
      (solution) => {
        if (solution.solutions.length !== 0 || isVerbose.value) {
          this.show(document.querySelector(`#${resultDomId}`), model.sparqlCount, solution.sparql, solution.sparql_timeout)
        }
      }
    )
  }

  show(dom, sparqlCount, sparql, sparql_timeout = null) {
    // Add line break to the sparql
    const formatedSparql = sparql
      .replace(/([{])/g, '$1\r\n')
      .replace(/([}])/g, '\r\n$1')
      .replace(/(\. )/g, '$1\r\n')
      .replace(/(, )/g, '$1\r\n')
      .replace(/( filter)/ig, '\r\n$1')
      .replace(/( limit)/ig, '\r\n$1')

    // Add a table to the dom tree
    dom
      .appendChild(createTable(formatedSparql, sparqlCount))

    // Enable syntax highlight of sparql
    /*global CodeMirror:true*/
    const textarea = dom.querySelectorAll('textarea')
    const editor = CodeMirror.fromTextArea(textarea[textarea.length - 1], {
      mode: 'application/sparql-query',
      readOnly: true,
      lineWrapping: true // wrap line if overflow
    })

    // Indent all lines
    const count = editor.lineCount()
    for (let i = 0; i < count; i++) {
      editor.indentLine(i)
    }

    if (sparql_timeout) {
      dom.appendChild(createDom(`
        <div class="error-region">
          <span>This sparql query is timed out!</span>
        </div>
      `))
    }
  }
}
