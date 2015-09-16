var _ = require('lodash'),
  show = function(el, msg) {
    el.innerHTML = msg;
  };

module.exports = function(domId) {
  var onOpen = _.partial(show, document.getElementById(domId), '<div class="lodqa-message">lodqa running ...<img src="images/working.gif"/></div>'),
    onClose = _.partial(show, document.getElementById(domId), '<div class="lodqa-message">lodqa finished.</div>');

  return {
    onOpen: onOpen,
    onClose: onClose
  };
}
