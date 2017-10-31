const DownloadButton = require('../presentation/download-button')
const handlebars = require('handlebars')

const template = handlebars.compile(`{{#each this}}
{{label}}	{{url}}
{{/each}}
`)

module.exports = class extends DownloadButton{
  constructor(parent, domSelector, onClick) {
    super(parent, domSelector, onClick, template)
  }
}
