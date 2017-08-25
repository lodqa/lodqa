module.exports = {
  getFocusInstanceId(solution, focus) {
    return Object.keys(solution)
      .filter(this.is)
      .find((id) => this.isNodeId(focus, id))
  },
  is: function(id) {
    return id[0] === 'i'
  },
  isNodeId: function(focus, instanceId) {
    return instanceId.substr(1) === focus
  }
}
