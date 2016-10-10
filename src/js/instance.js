module.exports = {
  is: function(id) {
    return id[0] === 'i'
  },
  isNodeId: function(focus, instanceId) {
    return instanceId.substr(1) === focus
  }
}
