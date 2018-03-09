const Handlebars = require('handlebars')

module.exports = Handlebars.compile(`
<div class="answer-media__cantainer">
  <span class="answer-media__title">{{title}}</span>
  <img class="answer-media__image" src="{{url}}" title="{{title}}" alt="{{title}}">
</diz>
`)
