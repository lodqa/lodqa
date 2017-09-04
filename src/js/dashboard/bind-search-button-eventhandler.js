module.exports = function() {
  document.querySelector('#search-button')
    .addEventListener('click', (e) => {
      const form = document.querySelector('#nlqform')

      if (form.checkValidity()) {
        // Do not submit form.
        e.preventDefault()
        location.href = `/answer?query=${encodeURIComponent(form.query.value)}&target=${form.target.value}&read_timeout=${form.read_timeout.value}`
      }else {
        form.querySelector('#query').focus()
      }
    })
}
