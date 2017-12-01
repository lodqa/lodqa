(() => {
  const pathname = '/answer3'
  const url = new URLSearchParams(window.location.search)
  const query =url.get('query') || ''
  const target = url.get('target') || ''
  const readTimeout = url.get('read_timeout') || ''
  const ws = new WebSocket(`ws://${location.host}${pathname}?query=${query}&target=${target}&read_timeout=${readTimeout}`)
  ws.onopen = () => console.log('open')
  ws.onclose = () => console.log('close')
  ws.onmessage = ({data}) => console.log(data)
})()
