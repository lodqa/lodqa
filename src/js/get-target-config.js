module.exports = function(target) {
  const myHeaders = new Headers()
  myHeaders.set('Accept', 'application/json')

  return fetch(`https://targets.lodqa.org/targets/${target}`, {
    method: 'GET',
    headers: myHeaders
  })
    .then((response) => {
      return response.json()
    })
}
