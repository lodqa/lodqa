const DownloadButton = require('../presentation/download-button')
const handlebars = require('handlebars')

const tsvFormatter = handlebars.compile(`{{#each this}}
{{label}}	{{url}}
{{/each}}
`)

module.exports = class extends DownloadButton{
  constructor(dom, onClick, model) {
    super(dom, onClick, model, tsvFormatter)
  }
}
