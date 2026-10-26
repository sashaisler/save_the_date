(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const config = window.WEDDING;
  const $ = selector => document.querySelector(selector);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-name]').forEach(el => { el.textContent = config.names[Number(el.dataset.name)]; });
  document.title = `${config.names.join(' & ')} — Save the date`;
  $('.wedding-date').setAttribute('aria-label', config.dateLabel);
  if (config.venue !== 'Woodbury Jewish Center') $('[data-venue]').textContent = config.venue;
  $('[data-location]').textContent = config.location;
  if (config.time) $('[data-time]').textContent = config.time;
  if (config.registryUrl && /^https:\/\//.test(config.registryUrl)) {
    $('#registry-link').href = config.registryUrl; $('#registry-link').hidden = false; $('.registry-note').hidden = false; $('#registry-pending').hidden = true;
  }
  for (const [key, path] of Object.entries(config.photos)) {
    if (!path) continue;
    const holder = document.querySelector(`[data-photo="${key}"]`);
    if (!holder) continue;
    const image = new Image(); image.alt = `Photo of ${config.names.join(' and ')}`; image.loading = 'lazy';
    image.addEventListener('load', () => { holder.replaceChildren(image); holder.hidden = false; }); image.src = path;
  }

  $('#calendar').addEventListener('click', () => {
    const escapeICS = value => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//June Twenty//Wedding//EN', 'BEGIN:VEVENT',
      'UID:sasha-eytan-20270620@save-the-date', `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      'DTSTART;VALUE=DATE:20270620', 'DTEND;VALUE=DATE:20270621', `SUMMARY:${escapeICS(config.names.join(' & ') + ' are getting married')}`,
      `LOCATION:${escapeICS(config.venue + ', ' + config.location)}`, 'DESCRIPTION:Save the date! Ceremony time and formal invitation to follow.', 'END:VEVENT', 'END:VCALENDAR'];
    const url = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'sasha-and-eytan-save-the-date.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const form = $('#guest-form');
  const siteOrigin = document.createElement('input');
  siteOrigin.type = 'hidden';
  siteOrigin.name = 'siteOrigin';
  siteOrigin.value = window.location.origin;
  form.append(siteOrigin);

  // The guest questions are three short chapters, with their values retained when going back.
  const steps = Array.from(document.querySelectorAll('[data-step]'));
  const stepLabels = ['01 — NAME', '02 — ADDRESS', '03 — ATTENDANCE'];
  let currentStep = 0;
  const showStep = (index, focus = true) => {
    currentStep = Math.max(0, Math.min(steps.length - 1, index));
    steps.forEach((step, i) => { step.hidden = i !== currentStep; });
    form.dataset.currentStep = String(currentStep);
    $('.step-label').textContent = stepLabels[currentStep];
    document.querySelectorAll('.step-dots i').forEach((dot, i) => dot.classList.toggle('active', i <= currentStep));
    if (focus) {
      const legend = steps[currentStep].querySelector('legend');
      legend.tabIndex = -1; legend.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
    }
  };
  const nextStep = () => {
    const invalid = Array.from(steps[currentStep].querySelectorAll('input, select')).find(input => !input.disabled && !input.checkValidity());
    if (invalid) { invalid.reportValidity(); return; }
    showStep(currentStep + 1);
  };
  document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', nextStep));
  document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => showStep(currentStep - 1)));
  form.addEventListener('invalid', event => {
    const step = event.target.closest('[data-step]');
    if (step && Number(step.dataset.step) !== currentStep) showStep(Number(step.dataset.step), false);
  }, true);
  form.addEventListener('keydown', event => {
    if (event.key === 'Enter' && currentStep < steps.length - 1 && event.target.tagName === 'INPUT') {
      event.preventDefault(); nextStep();
    }
  });
  showStep(0, false);

  const title = $('#title');
  const otherTitle = $('#titleOther');
  const syncTitle = (focus = false) => {
    const isOther = title.value === 'Other';
    $('#other-title-field').hidden = !isOther;
    otherTitle.disabled = !isOther;
    otherTitle.required = isOther;
    if (!isOther) otherTitle.value = '';
    else if (focus) otherTitle.focus();
  };
  title.addEventListener('change', () => syncTitle(true));
  syncTitle();

  const partner = $('#partnerName');
  // Keep the existing Sheets contract while showing a single optional spouse/fiance field.
  const syncSpouseName = () => { $('#hasPartner').value = partner.value.trim() ? 'yes' : ''; };
  partner.addEventListener('input', syncSpouseName);
  syncSpouseName();
  const endpoint = config.sheetsEndpoint;
  const connected = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint);
  $('#preview-note').hidden = connected;
  let activeRequest = null;
  let retryRequest = null;
  let timer;
  let pending = false;
  form.addEventListener('input', () => { if (!pending) retryRequest = null; });
  const button = $('#submit-response');
  const showError = message => {
    $('#form-error').textContent = message; $('#form-error').hidden = false;
    pending = false; button.disabled = false; button.firstElementChild.textContent = 'Try again';
  };
  const showSuccess = (preview, emailStatus) => {
    clearTimeout(timer); pending = false; activeRequest = null; retryRequest = null;
    form.hidden = true; $('#success').hidden = false;
    $('#success-title').textContent = preview ? 'Preview' : 'Thank you.';
    const emailCopy = emailStatus === 'sent' ? ' A confirmation with your answers has been emailed to you.' : emailStatus === 'queued' ? ' Your confirmation email is queued for delivery.' : '';
    $('#success-copy').textContent = preview ? 'Preview only. Nothing has been sent or saved.' : 'Your response has been saved.' + emailCopy;
    $('#edit-response').firstChild.textContent = preview ? 'Back to the preview ' : 'Submit another response ';
    $('#success').focus({ preventScroll: true });
    $('#success').scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'center' });
  };
  form.addEventListener('submit', event => {
    syncSpouseName();
    if (pending) { event.preventDefault(); return; }
    $('#form-error').hidden = true;
    if (!connected) { event.preventDefault(); showSuccess(true); return; }
    activeRequest = retryRequest || crypto.randomUUID();
    retryRequest = activeRequest;
    $('#requestId').value = activeRequest;
    form.action = endpoint;
    pending = true; button.disabled = true; button.firstElementChild.textContent = 'Submitting…';
    timer = setTimeout(() => {
      activeRequest = null;
      showError('We couldn’t confirm your response. Please try again — we’ll avoid adding it twice if it already arrived.');
    }, 35000);
    // A native POST targets the hidden iframe. Only a verified Google reply marks it as saved.
  });
  window.addEventListener('message', event => {
    const trusted = event.origin === 'https://script.google.com' || event.origin === 'https://script.googleusercontent.com' || /^https:\/\/[a-z0-9-]+\.script\.googleusercontent\.com$/.test(event.origin) || /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin);
    if (!trusted || !pending || !activeRequest || event.data?.type !== 'wedding-response' || event.data.requestId !== activeRequest) return;
    clearTimeout(timer);
    if (event.data.ok === true) showSuccess(false, event.data.emailStatus);
    else { activeRequest = null; retryRequest = null; showError('Your details weren’t saved. Please try again in a moment.'); }
  });
  $('#edit-response').addEventListener('click', () => {
    showStep(0, false); form.reset(); syncTitle(); syncSpouseName();
    $('#success').hidden = true; form.hidden = false; $('#form-error').hidden = true;
    button.disabled = false; button.firstElementChild.textContent = 'Submit'; $('#firstName').focus();
  });
})();
