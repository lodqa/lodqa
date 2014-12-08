var _ = require('lodash'),
  show = function(el, msg) {
    el.innerHTML = msg;
  };

module.exports = function(domId) {
  var onOpen = _.partial(show, document.getElementById(domId), 'lodqa running ...'),
    onClose = _.partial(show, document.getElementById(domId), 'lodqa finished.');

  return {
    onOpen: onOpen,
    onClose: onClose
  };
}
