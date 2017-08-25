const Handlebars = require('handlebars')

let initated = false
module.exports = function() {
  if (!initated) {
    Handlebars.registerPartial('sparql-link', '<a href="#" class="sparql-link" data-sparql-number="{{sparqlNumber}}">S{{sparqlNumber}}</a>')
    initated = true
  }
}
