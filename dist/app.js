(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const config = window.WEDDING;
  const $ = selector => document.querySelector(selector);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-name]').forEach(el => { el.textContent = config.names[Number(el.dataset.name)]; });
document.title = `${config.names.join(' & ')} — Wedding`;
  $('.wedding-date').setAttribute('aria-label', config.dateLabel);
  if (config.venue !== 'Woodbury Jewish Center') $('[data-venue]').textContent = config.venue;
  $('[data-location]').textContent = config.location;
  if (config.time) document.querySelectorAll('[data-time]').forEach(el => { el.textContent = config.time; });
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

  const calendarLink = $('#calendar');
  const startDate = new Date(config.calendarStart);
  const startsAt = startDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const eventTitle = config.names.join(' & ') + ' — Wedding';
  const eventLocation = config.venue + ', ' + config.location;
  const eventDescription = config.time + ' New York time. End time to be confirmed. Formal invitation to follow.';
  const googleCalendar = new URL('https://calendar.google.com/calendar/r/eventedit');
  // Google expects a range; equal endpoints avoid inventing a wedding end time.
  googleCalendar.search = new URLSearchParams({action: 'TEMPLATE', text: eventTitle,
    dates: startsAt + '/' + startsAt, stz: 'America/New_York', etz: 'America/New_York',
    details: eventDescription, location: eventLocation}).toString();
  calendarLink.href = googleCalendar.href;

  const form = $('#guest-form');
  const siteOrigin = document.createElement('input');
  siteOrigin.type = 'hidden';
  siteOrigin.name = 'siteOrigin';
  siteOrigin.value = window.location.origin;
  form.append(siteOrigin);

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
    form.reset(); syncTitle(); syncSpouseName();
    $('#success').hidden = true; form.hidden = false; $('#form-error').hidden = true;
    button.disabled = false; button.firstElementChild.textContent = 'Submit'; $('#firstName').focus();
  });
})();
