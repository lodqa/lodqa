var show = function(el) {
    return function(msg) {
      el.innerHTML = msg;
    }
  }(document.getElementById('lodqa-messages')),
  onOpen = function() {
    show('lodqa running ...');
  },
  onClose = function() {
    show('lodqa finished.');
  };

module.exports = {
  onOpen: onOpen,
  onClose: onClose
};
