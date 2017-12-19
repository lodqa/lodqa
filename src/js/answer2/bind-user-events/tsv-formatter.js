const handlebars = require('handlebars')

module.exports = handlebars.compile(`{{#each this}}
{{label}}	{{url}}
{{/each}}
`)
