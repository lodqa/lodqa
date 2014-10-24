(function() {
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

  this.lodqaClient = this.lodqaClient || {};
  this.lodqaClient.websocketPresentation = {
    onOpen: onOpen,
    onClose: onClose
  };
}.call(this));
