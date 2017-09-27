module.exports = function(target) {
  const myHeaders = new Headers()
  myHeaders.set('Accept', 'application/json')

  return fetch(`http://targets.lodqa.org/targets/${target}`, {
    method: 'GET',
    headers: myHeaders
  })
    .then((response) => {
      return response.json()
    })
}
