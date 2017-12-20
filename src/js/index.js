const bindReadTimeoutNumberEventhandler = require('./controller/bind-read-timeout-number-eventhandler')
const bindModeButtonEventhandler = require('./controller/bind-mode-button-eventhandler')

bindModeButtonEventhandler('grapheditor')
bindReadTimeoutNumberEventhandler((readTimeout) => {
  for (const link of document.querySelectorAll('.sample-queries__link')) {
    const url = new URL(link.href)
    url.searchParams.set('read_timeout', readTimeout)
    link.href= url.toString()
  }
})
