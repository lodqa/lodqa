const pgp = JSON.parse(document.querySelector('#pgp').innerHTML)
const mappings = JSON.parse(document.querySelector('#mappings').innerHTML)
const config = document.querySelector('#target').innerHTML
const ws = new WebSocket(`ws://${location.host}/solutions?target=${config}`)
ws.onopen = (event) => {
  event.target.send(JSON.stringify({
    pgp,
    mappings
  }))
}
ws.onmessage = (message) => {
  console.log(message)
}
