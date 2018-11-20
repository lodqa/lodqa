const Handlebars = require('handlebars')

module.exports = Handlebars.compile(`
{{#if isWaittingResult}}
  <i class="fa fa-spinner fa-spin fa-fw"></i>
  {{#if error}}
    <span class="message__error"><i class="fa fa-bomb"></i> {{error.error_message}}</span>
  {{/if}}
{{/if}}
`)
