module.exports = function() {
  document.querySelector('.description')
    .addEventListener('click', (e) => {

      if (e.target.localName === 'a') {
        const url = new URL(e.target.href)
        url.searchParams.set('read_timeout', document.querySelector('#read_timeout')
          .value)
        e.target.href = url.toString()
      }
    })
}
