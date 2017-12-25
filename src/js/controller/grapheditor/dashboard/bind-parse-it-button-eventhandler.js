module.exports = function() {
  const button = document.querySelector('#parse-it-button')

  if (button) {
    button.addEventListener('click', (e) => {
      const form = document.querySelector('#nlqform')

      if (form.checkValidity()) {
        // Do not submit form.
        e.preventDefault()
        location.href = `/grapheditor?query=${encodeURIComponent(form.query.value)}&target=${form.target.value}`
      } else {
        form.querySelector('#query')
          .focus()
      }
    })
  }
}
