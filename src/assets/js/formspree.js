(function() {
  'use strict';

  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    if (!/formspree\.io/.test(form.action)) return;

    e.preventDefault();

    var submitBtn = form.querySelector('[type="submit"]');
    var originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    var existingError = form.querySelector('.cs-form-error');
    if (existingError) existingError.remove();

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    }).then(function(response) {
      if (response.ok) {
        showSuccess(form);
      } else {
        showError(form, submitBtn, originalText);
      }
    }).catch(function() {
      showError(form, submitBtn, originalText);
    });
  });

  function showSuccess(form) {
    var msg = document.createElement('div');
    msg.className = 'cs-form-success';
    msg.setAttribute('role', 'status');
    msg.setAttribute('aria-live', 'polite');

    var heading = document.createElement('h3');
    heading.textContent = 'Message sent!';
    var body = document.createElement('p');
    body.textContent = "Thanks for reaching out — we'll get back to you within 24 hours.";
    msg.appendChild(heading);
    msg.appendChild(body);

    while (form.firstChild) form.removeChild(form.firstChild);
    form.appendChild(msg);
    msg.focus && msg.focus();
  }

  function showError(form, submitBtn, originalText) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText || 'Send Message';
    }
    var msg = document.createElement('p');
    msg.className = 'cs-form-error';
    msg.setAttribute('role', 'alert');
    msg.textContent = "Something went wrong sending your message. Please try again, or email us directly.";
    form.appendChild(msg);
  }
})();
