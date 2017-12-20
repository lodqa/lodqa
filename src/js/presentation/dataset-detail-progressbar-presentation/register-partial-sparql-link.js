const Handlebars = require('handlebars')

let initated = false
module.exports = function() {
  if (!initated) {
    Handlebars.registerPartial('sparql-link', '<a href="#" class="sparql-link" data-dataset-name="{{datasetName}}" data-sparql-number="{{sparqlNumber}}">S{{sparqlName}}</a>')
    initated = true
  }
}
