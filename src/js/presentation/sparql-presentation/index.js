const createTable = require('./create-table')
const createDom = require('../create-dom')

const privateData = {}

class SparqlPresentation {
  show(dom, data, sparqlCount) {
    const {
      sparql,
      solutions,
      sparql_timeout
    } = data

    if (solutions.length === 0 && !privateData.verbose) {
      return
    }

    // Add a table to the dom tree
    dom
      .appendChild(createTable(sparql, sparqlCount))

    // Enable syntax highlight of sparql
    /*global CodeMirror:true*/
    const sparqls = dom.querySelectorAll('textarea')
    CodeMirror
      .fromTextArea(sparqls[sparqls.length - 1], {
        mode: 'application/sparql-query',
        readOnly: true,
        hardwrap: true
      })
      .wrapParagraph(undefined, {
        column: 125
      })

    if (sparql_timeout) {
      dom.appendChild(createDom(`
        <div class="error-region">
          <span>This sparql query is timed out!</span>
        </div>
      `))
    }
  }

  setVerbose(value) {
    privateData.verbose = value
  }
}

module.exports = new SparqlPresentation
