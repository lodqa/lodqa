const Message = require('../../../model/message')
const MessagePresentation = require('../../../presentation/message-presentation')

module.exports = function(loader) {
  const message = new Message(loader)
  new MessagePresentation(document.querySelector('.message'), message)
}
