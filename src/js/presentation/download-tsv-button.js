const DownloadButton = require('../presentation/download-button')
const handlebars = require('handlebars')

const template = handlebars.compile(`{{#each this}}
{{label}}	{{url}}
{{/each}}
`)

module.exports = class extends DownloadButton{
  constructor(domId, onClick) {
    super(domId, onClick, template)
  }
}
