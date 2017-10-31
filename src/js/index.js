const bindReadTimeoutNumberEventhandler = require('./controller/bind-read-timeout-number-eventhandler')
const bindModeButtonEventhandler = require('./controller/bind-mode-button-eventhandler')
const {
  updateTarget,
  updateReadTimeout
} = require('./index/update-sample-queries')

bindModeButtonEventhandler('grapheditor')

const target = new URL(location.href)
  .searchParams.get('target')
const targetDom = document
  .querySelector('.description')

if (target && targetDom) {
  updateTarget(targetDom, target)
  bindReadTimeoutNumberEventhandler((readTimeout) => updateReadTimeout(targetDom, readTimeout))
}
