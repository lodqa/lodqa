const Handlebars = require('handlebars')

module.exports = Handlebars.compile(`
<div class="answer-media__cantainer">
  {{#if image}}
  <span class="answer-media__title">{{title}}</span>
  <img class="answer-media__image" src="{{url}}" title="{{title}}" alt="{{title}}">
  {{/if}}
  {{#if audio}}
  <audio class="answer-media__audio" controls preload="none" src="{{url}}" type="{{mime_type}}"></audio>
  {{/if}}
  {{#if video}}
  <video class="answer-media__video" controls src="{{url}}" type="{{mime_type}}"></audio>
  {{/if}}
</div>
`)
