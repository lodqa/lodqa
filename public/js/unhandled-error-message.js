window.onerror = function(messageOrEvent, source, lineno, colno, error) {
  var message = 'LODQA encountered a problem.\n\n'
    + 'Note that LODQA has been developed using HTML5, and tested on Chrome, FireFox, and  Safari.\n'
    + 'Please use it on a latest version of one of the above browsers.\n'
    + 'If you still experience a problem in one of the browsers, please let us know (admin@pubannotation.org)\n'

  window.confirm(message)
}
