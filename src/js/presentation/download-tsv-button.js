const DownloadButton = require('../presentation/download-button')
const handlebars = require('handlebars')

const template = handlebars.compile(`{{#each this}}
{{label}}	{{url}}
{{/each}}
`)

module.exports = class extends DownloadButton{
  constructor(dom, onClick) {
    super(dom, onClick, template)
  }
}
