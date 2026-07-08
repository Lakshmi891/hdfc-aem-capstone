import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

const AEM_AUTHOR_FORMS_BASE = '/content/forms/af/lakshmi-forms-capstone';

function getEDSUrl(path) {
  return window.location.hostname.includes('adobeaemcloud.com')
    ? `${AEM_AUTHOR_FORMS_BASE}${path}.html?ref=otp-login`
    : path;
}

function initLoanJourneyHandlers() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (!btn.textContent.trim().toLowerCase().includes('view loan eligibility')) return;
    e.preventDefault();
    e.stopPropagation();

    // Find a form input by searching label text — works regardless of AEM field names
    function getByLabel(keywords) {
      const wrappers = [...document.querySelectorAll('.field-wrapper')];
      let found = '';
      wrappers.some((wrapper) => {
        const label = wrapper.querySelector('label');
        if (!label) return false;
        const txt = label.textContent.trim().toLowerCase();
        if (keywords.some((k) => txt.includes(k))) {
          const inp = wrapper.querySelector(
            'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])',
          );
          if (inp && inp.value) { found = inp.value; return true; }
        }
        return false;
      });
      return found;
    }

    const mobile = (
      document.querySelector('input[name="aadhaar_mobile_number"]')?.value
      || document.querySelector('input[type="tel"]')?.value
      || getByLabel(['mobile', 'aadhaar'])
      || ''
    ).trim();
    const idTypeEl = document.querySelector('input[name="id_type"]:checked')
      || document.querySelector('fieldset.radio-group-wrapper input[type="radio"]:checked');
    const idType = idTypeEl ? idTypeEl.value : 'Date of Birth';
    const pan = (
      document.querySelector('input[name="pan_card_number"]')?.value
      || document.querySelector('input[name*="pan" i]')?.value
      || getByLabel(['pan'])
      || ''
    ).trim().toUpperCase();
    const dob = (
      document.querySelector('input[name="dob_input"]')?.value
      || document.querySelector('input[name*="dob" i]')?.value
      || document.querySelector('input[name*="birth" i]')?.value
      || document.querySelector('input[name*="date" i]:not([name*="pan" i])')?.value
      || document.querySelector('input[type="date"]')?.value
      || getByLabel(['date of birth', 'birth date', 'dob', 'birth', 'date'])
      || ''
    ).trim();

    // Debug: log every input on the form so we can see field names/labels/values
    // eslint-disable-next-line no-console
    console.info('[Journey] All form inputs:', [...document.querySelectorAll('main .form input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])')].map((i) => `${i.type}|name=${i.name}|label=${i.closest('.field-wrapper')?.querySelector('label')?.textContent?.trim()}|val=${i.value}`));
    // eslint-disable-next-line no-console
    console.info('[Journey] Login fields captured — mobile:', mobile || '✗', 'isPan:', /pan/i.test(idType), 'pan:', pan || '✗', 'dob:', dob || '✗');

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      const errEl = document.querySelector('input[name="otp_instruction"]') || document.querySelector('[name="otp_instruction"]');
      if (errEl) errEl.value = 'Please enter a valid 10-digit mobile number.';
      return;
    }

    // Radio value varies by AEM form config — match loosely
    const isPan = /pan/i.test(idType);

    if (isPan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
      const errEl = document.querySelector('input[name="otp_instruction"]') || document.querySelector('[name="otp_instruction"]');
      if (errEl) errEl.value = 'Please enter a valid PAN (e.g. ABCDE1234F).';
      return;
    }

    if (!isPan && !dob) {
      const errEl = document.querySelector('input[name="otp_instruction"]') || document.querySelector('[name="otp_instruction"]');
      if (errEl) errEl.value = 'Please enter your Date of Birth.';
      return;
    }

    try {
      const journeyId = `PJ_${Date.now()}`;
      const data = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
      data.partnerJourneyID = journeyId;
      data.bankJourneyID = `BJ_${Date.now()}`;
      data.identifierName = isPan ? 'PAN_NO' : 'DOB';
      data.identifierValue = isPan ? pan : dob;
      data.pan = pan;
      data.dob = dob;
      data.mobileNo = mobile;
      data.mockOTP = Math.floor(100000 + Math.random() * 900000).toString();
      // eslint-disable-next-line no-console
      console.info('[Journey] Saving — mobileNo:', mobile, 'isPan:', isPan, 'pan:', pan, 'dob:', dob);
      sessionStorage.setItem('loanJourneyData', JSON.stringify(data));
      window.location.href = getEDSUrl('/personal-loan-otp');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Journey] Failed to initiate:', err);
    }
  });
}

function initOTPPageHandlers() {
  if (!window.location.pathname.includes('personal-loan-otp')) return;

  const MOCK_OFFER = {
    customerFirstName: 'Ankit',
    customerLastName: 'Enterprises',
    customerAddress1: '1301, Barkha',
    customerCity: 'Mumbai',
    customerState: 'Maharashtra',
    zipCode: '400016',
    emailAddress: 'ankit@gmail.com',
    offerAmount: '1000000.00',
    tenure: '36',
    rateOfInterest: '10.20',
    kycFlag: 'Y',
    accountNumber: 'XX50151',
    customerID: 'XX12345',
    employerName: 'Apollo Services',
    residenceType: 'Owned by Parents',
    dateOfBirth: '1990-05-15',
  };

  function getJourneyData() {
    return JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
  }

  function showOTPError(message) {
    const wrapper = document.querySelector('.field-otp-code');
    if (!wrapper) return;
    let errEl = wrapper.querySelector('.wv-field-error');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'wv-field-error';
      wrapper.appendChild(errEl);
    }
    errEl.textContent = message;
    errEl.style.display = 'block';
    wrapper.classList.add('otp-has-error');
  }

  function clearOTPError() {
    const wrapper = document.querySelector('.field-otp-code');
    if (!wrapper) return;
    const errEl = wrapper.querySelector('.wv-field-error');
    if (errEl) errEl.style.display = 'none';
    wrapper.classList.remove('otp-has-error');
  }

  function updateOTPSubmitBtn() {
    const otpInput = document.querySelector('input[name="otp_code"]');
    const submitBtn = document.querySelector(
      '.field-help-us-confirm-this-is-you .field-submit-otp button:not(.resend-otp-btn)',
    );
    if (!submitBtn) return;
    const len = (otpInput?.value || '').trim().length;
    submitBtn.disabled = len < 6;
  }

  // Sets text on the element: prefers inner <input> if the target is a wrapper,
  // then falls back to .value for inputs or .textContent for everything else.
  function setElText(el, text) {
    if (!el) return;
    const inner = el.tagName !== 'INPUT' && el.tagName !== 'BUTTON'
      ? el.querySelector('input, textarea')
      : null;
    const target = inner || el;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      // eslint-disable-next-line no-param-reassign
      target.value = text;
    } else {
      // eslint-disable-next-line no-param-reassign
      target.textContent = text;
    }
  }

  function elText(el) {
    return ((el.tagName === 'INPUT' ? el.value : el.textContent) || '').trim();
  }

  // Finds attempts element.
  // CSS class field-attempts-left comes from toClassName('attempts_left').
  function findAttemptsEl() {
    return (
      document.querySelector('[name="attempts_left"]')
      || document.querySelector('.field-attempts-left p')
      || document.querySelector('.field-attempts-left input')
      || [...document.querySelectorAll('p:not(.wv-field-error), span:not(.wv-field-error), label')]
        .find((el) => el.childElementCount === 0 && /attempt.*left/i.test(elText(el)))
    );
  }

  // Finds the timer/resend plain-text <p> element.
  // CSS class field-resend-otp-timer from toClassName('resend_otp_timer').
  function getTimerP() {
    const wrapper = document.querySelector('.field-resend-otp-timer');
    if (wrapper) return wrapper.querySelector('p') || wrapper;
    return [...document.querySelectorAll('p')]
      .find((el) => /resend\s+otp\s+in/i.test(el.textContent)) || null;
  }

  // Replaces the masked mobile text in the page with the actual value from session.
  // Format: XXXXX****X (first 5 visible, 4 asterisks, last digit visible)
  function updateMaskedMobile(mobileNo) {
    if (!mobileNo) return;
    const m = mobileNo.toString().trim();
    if (m.length < 6) return;
    const masked = `${m.substring(0, 5)}${'*'.repeat(4)}${m.slice(-1)}`;
    // Try a named field first (if form has one)
    const namedEl = document.querySelector('[name="mobile_display"],[name="otp_mobile"],[name="masked_mobile"]');
    if (namedEl) { setElText(namedEl, masked); return; }
    // Fallback: walk text nodes and replace any existing masked-mobile pattern
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      if (/\*{3,}\d+/.test(node.textContent)) nodes.push(node);
      node = walker.nextNode();
    }
    nodes.forEach((n) => {
      // eslint-disable-next-line no-param-reassign
      n.textContent = n.textContent.replace(/\*{3,}\d+/, masked);
    });
  }

  // resend_otp_timer is a plain-text field — no <button> exists on EDS.
  // After countdown we transform the same <p> into a clickable "Resend OTP" element.
  let timerStarted = false;
  let otpResendEl = null; // the <p> used for both countdown text and resend trigger

  function doResendOTP() {
    const data = getJourneyData();
    const left = Math.max(0, parseInt(data.resendAttemptsLeft || '3', 10) - 1);
    data.resendAttemptsLeft = left.toString();
    data.otpAttemptsLeft = '3';
    data.mockOTP = Math.floor(100000 + Math.random() * 900000).toString();
    sessionStorage.setItem('loanJourneyData', JSON.stringify(data));

    const otpEl = document.querySelector('input[name="otp_code"]');
    if (otpEl) otpEl.value = data.mockOTP;
    clearOTPError();
    updateOTPSubmitBtn();
    const attEl = findAttemptsEl();
    if (attEl) setElText(attEl, `${left}/3 attempt(s) left`);

    if (left <= 0) {
      // No more resend attempts — hide the timer element and remove the button
      if (otpResendEl) {
        const wrap = otpResendEl.closest('.field-wrapper') || otpResendEl.parentElement;
        if (wrap) wrap.style.display = 'none';
      }
      const exhaustedBtn = document.querySelector(
        '.field-help-us-confirm-this-is-you .field-submit-otp .resend-otp-btn',
      );
      if (exhaustedBtn) exhaustedBtn.remove();
      return;
    }

    // Remove the injected Resend OTP button from the submit row
    const injectedBtn = document.querySelector(
      '.field-help-us-confirm-this-is-you .field-submit-otp .resend-otp-btn',
    );
    if (injectedBtn) injectedBtn.remove();

    // Reset the timer <p> back to countdown text and restart
    if (otpResendEl) {
      otpResendEl.textContent = 'Resend OTP in: 21 secs';
      otpResendEl.style.cssText = '';
      otpResendEl.classList.remove('resend-otp-btn');
      otpResendEl.removeAttribute('role');
      otpResendEl.removeAttribute('tabindex');
    }
    timerStarted = false;
    // Arrow wrapper avoids no-use-before-define since startOTPTimer is declared below
    // eslint-disable-next-line no-use-before-define
    setTimeout(() => { startOTPTimer(); }, 0);
  }

  function startOTPTimer() {
    if (timerStarted) return;
    timerStarted = true;

    let waitTicks = 0;
    function setup() {
      const timerP = getTimerP();
      if (!timerP && waitTicks < 15) {
        waitTicks += 1;
        setTimeout(setup, 200);
        return;
      }

      otpResendEl = timerP || null;

      // Reset element to plain countdown state
      if (otpResendEl) {
        otpResendEl.style.cssText = '';
        otpResendEl.removeAttribute('role');
        otpResendEl.removeAttribute('tabindex');
      }

      function setTimerText(secs) {
        if (!otpResendEl) return;
        const bold = otpResendEl.querySelector('strong, b');
        if (bold) { bold.textContent = `${secs} secs`; } else {
          otpResendEl.textContent = `Resend OTP in: ${secs} secs`;
        }
      }

      let remaining = 21;
      setTimerText(remaining);

      function tick() {
        remaining -= 1;
        if (remaining <= 0) {
          timerStarted = false;
          if (otpResendEl) {
            const data = getJourneyData();
            if (parseInt(data.resendAttemptsLeft || '3', 10) <= 0) return;
            // Keep the timer <p> as plain "Resend OTP in: 0" text in the meta row
            otpResendEl.textContent = 'Resend OTP in: 0';
            otpResendEl.style.cssText = '';
          }
          // Inject a Resend OTP button into the submit row (same row as Submit button)
          const submitWrapper = document.querySelector(
            '.field-help-us-confirm-this-is-you .field-submit-otp',
          );
          if (submitWrapper && !submitWrapper.querySelector('.resend-otp-btn')) {
            const data = getJourneyData();
            if (parseInt(data.resendAttemptsLeft || '3', 10) > 0) {
              const resendBtn = document.createElement('button');
              resendBtn.type = 'button';
              resendBtn.textContent = 'Resend OTP';
              resendBtn.className = 'resend-otp-btn';
              submitWrapper.appendChild(resendBtn);
            }
          }
          // Also reveal an actual button if present (AEM cloud)
          const actualBtn = document.querySelector('[name="resend_otp_timer"]');
          if (actualBtn) {
            (actualBtn.closest('.field-wrapper') || actualBtn).style.display = 'block';
          }
        } else {
          setTimerText(remaining);
          setTimeout(tick, 1000);
        }
      }
      setTimeout(tick, 1000);
    }
    setup();
  }

  function populateOTPPage() {
    const data = getJourneyData();
    if (!data.mockOTP) {
      data.mockOTP = Math.floor(100000 + Math.random() * 900000).toString();
      data.otpAttemptsLeft = '3';
      data.resendAttemptsLeft = '3';
      sessionStorage.setItem('loanJourneyData', JSON.stringify(data));
    }
    // eslint-disable-next-line no-console
    console.info(`[Journey] Test OTP: ${data.mockOTP}`);

    const otpEl = document.querySelector('input[name="otp_code"]');
    const attemptsEl = findAttemptsEl();

    if (otpEl && !otpEl.value) otpEl.value = data.mockOTP;
    updateOTPSubmitBtn();
    startOTPTimer();
    if (attemptsEl) setElText(attemptsEl, `${data.resendAttemptsLeft || 3}/3 attempt(s) left`);
    updateMaskedMobile(data.mobileNo);
    return !!(otpEl && otpEl.value);
  }

  function initOTPEyeToggle() {
    const otpWrapper = document.querySelector('.field-otp-code');
    const otpInput = otpWrapper?.querySelector('input[name="otp_code"]');
    if (!otpInput || otpWrapper.querySelector('.otp-input-container')) return;
    otpInput.type = 'text';
    otpInput.removeAttribute('minlength');
    otpInput.setAttribute('maxlength', '6');
    otpInput.addEventListener('invalid', (e) => e.preventDefault());
    otpInput.addEventListener('input', () => { clearOTPError(); updateOTPSubmitBtn(); });

    const container = document.createElement('div');
    container.className = 'otp-input-container';
    otpInput.parentNode.insertBefore(container, otpInput);
    container.appendChild(otpInput);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'otp-eye-toggle';
    toggle.setAttribute('aria-label', 'Hide OTP');
    const eyeOpen = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    const eyeClosed = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    toggle.innerHTML = eyeOpen;
    toggle.addEventListener('click', () => {
      const isVisible = otpInput.type === 'text';
      otpInput.type = isVisible ? 'password' : 'text';
      toggle.innerHTML = isVisible ? eyeClosed : eyeOpen;
      toggle.setAttribute('aria-label', isVisible ? 'Show OTP' : 'Hide OTP');
    });
    container.appendChild(toggle);
  }

  let retries = 0;
  const poll = setInterval(() => {
    retries += 1;
    initOTPEyeToggle();
    if (populateOTPPage() || retries >= 20) clearInterval(poll);
  }, 300);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // Resend OTP button (AEM cloud actual button) — delegate to doResendOTP
    if (btn.name === 'resend_otp_timer' || /^resend.*otp$/i.test(btn.textContent.trim())) {
      e.preventDefault();
      doResendOTP();
      return;
    }

    if (!btn.textContent.trim().toLowerCase().includes('submit')) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const data = getJourneyData();
    const entered = (document.querySelector('input[name="otp_code"]')?.value || '').trim();
    const stored = data.mockOTP || '';

    if (entered !== stored) {
      const left = Math.max(0, parseInt(data.otpAttemptsLeft || '3', 10) - 1);
      data.otpAttemptsLeft = left.toString();
      sessionStorage.setItem('loanJourneyData', JSON.stringify(data));
      showOTPError(left === 0 ? 'No attempts left. Please resend OTP.' : 'Invalid OTP. Please try again.');
      // eslint-disable-next-line no-console
      console.info(`[Journey: ${data.partnerJourneyID}] OTP mismatch, ${left} attempt(s) left`);
      return;
    }

    data.offerDemogDetails = MOCK_OFFER;
    data.customerName = `${MOCK_OFFER.customerFirstName} ${MOCK_OFFER.customerLastName}`;
    sessionStorage.setItem('loanJourneyData', JSON.stringify(data));
    // eslint-disable-next-line no-console
    console.info(`[Journey: ${data.partnerJourneyID}] OTP verified, offer loaded`);
    window.location.href = getEDSUrl('/personal-loan-offer');
  }, true);
}

function initOfferPageHandlers() {
  const { pathname } = window.location;
  if (!pathname.includes('personal-loan-offer') && !pathname.includes('offer-display')) return;

  // eslint-disable-next-line no-console
  console.info('[Journey] Offer page handler active');

  function calcEMI(P, n) {
    if (!P || !n) return 0;
    const r = 10.20 / (12 * 100);
    const powered = (1 + r) ** n;
    return Math.round((P * r * powered) / (powered - 1));
  }

  function fmtINR(n) {
    const s = String(Math.round(n));
    if (s.length <= 3) return `₹${s}`;
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    return `₹${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
  }

  function getVal(name) {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return null;
    const inp = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
      ? el : el.querySelector('input, textarea');
    return inp ? inp.value : null;
  }

  function setVal(name, value) {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return;
    const inp = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
      ? el : el.querySelector('input, textarea');
    if (!inp) return;
    // eslint-disable-next-line no-param-reassign
    inp.value = value;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function updateOfferDisplay() {
    const P = parseFloat(getVal('loan_amount')) || 1500000;
    const n = parseInt(getVal('tenure_months'), 10) || 84;
    // eslint-disable-next-line no-console
    console.info(`[Journey] EMI calc: P=${P} n=${n}`);
    setVal('emi_display', fmtINR(calcEMI(P, n)));
    setVal('rate_of_interest', '10.20%');
    setVal('taxes', fmtINR(Math.round(P * 0.02 * 0.18)));
  }

  function setRangeDefaults() {
    const loanInp = document.querySelector('[name="loan_amount"]');
    const tenureInp = document.querySelector('[name="tenure_months"]');
    if (loanInp) {
      loanInp.value = 1500000;
      loanInp.dispatchEvent(new Event('input', { bubbles: true }));
      loanInp.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (tenureInp) {
      tenureInp.value = 84;
      tenureInp.dispatchEvent(new Event('input', { bubbles: true }));
      tenureInp.dispatchEvent(new Event('change', { bubbles: true }));
    }
    updateOfferDisplay();
  }

  // Poll every 100ms until AEM has set its defaults, then immediately override.
  // This eliminates the 2s flash of wrong values.
  let userInteracted = false;
  let pollCount = 0;
  const pollInterval = setInterval(() => {
    pollCount += 1;
    const loanInp = document.querySelector('[name="loan_amount"]');
    const tenureInp = document.querySelector('[name="tenure_months"]');
    if (loanInp && tenureInp && (loanInp.value || pollCount > 15)) {
      clearInterval(pollInterval);
      if (!userInteracted) setRangeDefaults();
    }
    if (pollCount >= 60) clearInterval(pollInterval);
  }, 100);

  document.addEventListener('input', (e) => {
    if (e.target.closest('[name="loan_amount"]') || e.target.closest('[name="tenure_months"]')) {
      userInteracted = true;
      updateOfferDisplay();
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.closest('[name="loan_amount"]') || e.target.closest('[name="tenure_months"]')) {
      userInteracted = true;
      updateOfferDisplay();
    }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (!btn.textContent.trim().toLowerCase().includes('proceed')) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const P = parseFloat(getVal('loan_amount')) || 1500000;
    const n = parseInt(getVal('tenure_months'), 10) || 84;

    const data = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
    data.selectedLoanAmount = P;
    data.selectedTenure = n;
    data.selectedEMI = calcEMI(P, n);
    data.selectedRate = 10.20;
    sessionStorage.setItem('loanJourneyData', JSON.stringify(data));

    window.location.href = getEDSUrl('/personal-loan-preview');
  }, true);
}

function initPreviewPageHandlers() {
  if (!window.location.pathname.includes('personal-loan-preview')) return;
  // eslint-disable-next-line no-console
  console.info('[Journey] Preview page handler active');

  function setVal(name, value) {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return false;
    const inp = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
      ? el : el.querySelector('input, textarea');
    if (!inp) return false;
    // eslint-disable-next-line no-param-reassign
    inp.value = value;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // Finds a field by its visible label text and sets its value.
  // Used as fallback when AEM field names differ from expected.
  function setValByLabel(labelKeywords, value) {
    if (!value) return false;
    const wrappers = [...document.querySelectorAll('.field-wrapper')];
    return wrappers.some((wrapper) => {
      const label = wrapper.querySelector('label');
      if (!label) return false;
      const txt = label.textContent.trim().toLowerCase();
      if (labelKeywords.some((k) => txt.includes(k))) {
        const inp = wrapper.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea');
        if (inp) {
          // eslint-disable-next-line no-param-reassign
          inp.value = value;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    });
  }

  function maskPAN(pan) {
    if (!pan || pan.length < 10) return pan || '';
    return `***** *${pan.substring(5, 9)} ${pan.substring(9)}`;
  }

  function populatePreview() {
    document.querySelector('main .form form')?.classList.add('preview-form');
    const data = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
    const offer = data.offerDemogDetails || {};
    const P = parseFloat(data.selectedLoanAmount) || parseFloat(offer.offerAmount) || 1000000;
    const n = parseInt(data.selectedTenure, 10) || parseInt(offer.tenure, 10) || 36;
    const rate = parseFloat(data.selectedRate) || parseFloat(offer.rateOfInterest) || 10.20;
    const emi = parseInt(data.selectedEMI, 10) || 0;
    const processingFee = Math.round(P * 0.02);
    const fullName = data.customerName
      || [offer.customerFirstName, offer.customerLastName].filter(Boolean).join(' ')
      || 'Ankit Enterprises';
    const mobile = data.mobileNo || '';
    // Read pan/dob saved directly; fall back to identifierValue, then mock offer data
    const pan = data.pan || (data.identifierName === 'PAN_NO' ? (data.identifierValue || '') : '');
    const dob = data.dob
      || (data.identifierName === 'DOB' ? (data.identifierValue || '') : '')
      || offer.dateOfBirth
      || '';
    const address = [
      offer.customerAddress1 || '1301, Barkha',
      offer.customerCity || 'Mumbai',
      offer.customerState || 'Maharashtra',
      offer.zipCode || '400016',
    ].join(', ');

    setVal('preview_loan_amount', `₹ ${P.toLocaleString('en-IN')}`);
    setVal('preview_emi', `₹ ${emi.toLocaleString('en-IN')}`);
    setVal('preview_tenure', `${n} months`);
    setVal('preview_processing_fee', `₹ ${processingFee.toLocaleString('en-IN')}`);
    setVal('preview_rate', `${rate}%`);
    setVal('preview_employer_name', offer.employerName || 'Apollo Services');
    setVal('preview_loan_type', 'Fresh Loan');
    setVal('preview_full_name', fullName);
    if (!setVal('preview_mobile', mobile ? `+91 ${mobile}` : '')) {
      setValByLabel(['mobile'], mobile ? `+91 ${mobile}` : '');
    }
    if (!setVal('preview_dob', dob)) {
      setValByLabel(['date of birth', 'dob'], dob);
    }
    if (!setVal('preview_pan', pan ? maskPAN(pan) : '')) {
      setValByLabel(['pan'], pan ? maskPAN(pan) : '');
    }
    setVal('preview_address', address);
    setVal('preview_residence_type', offer.residenceType || 'Owned by Parents');
  }

  setTimeout(populatePreview, 1000);
  setTimeout(populatePreview, 2000);
  setTimeout(populatePreview, 4000);
  setTimeout(populatePreview, 6000);

  function addScheduleChargesLink() {
    const wrapper = document.querySelector('.field-schedule-charges');
    if (!wrapper || wrapper.querySelector('.schedule-charges-link')) return;
    const link = document.createElement('a');
    link.className = 'schedule-charges-link';
    link.textContent = 'Click here';
    link.href = '#';
    link.target = '_blank';
    wrapper.appendChild(link);
  }

  setTimeout(addScheduleChargesLink, 1500);

  function initAccordion() {
    const panels = document.querySelectorAll(
      'fieldset.panel-wrapper.field-loan-details, fieldset.panel-wrapper.field-personal-details',
    );
    panels.forEach((panel) => {
      const legend = panel.querySelector(':scope > legend');
      if (!legend) return;
      legend.addEventListener('click', () => {
        if (panel.hasAttribute('data-collapsed')) {
          panel.removeAttribute('data-collapsed');
        } else {
          panel.setAttribute('data-collapsed', '');
        }
      });
    });
  }

  setTimeout(initAccordion, 1500);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const txt = btn.textContent.trim().toLowerCase();
    if (!txt.includes('confirm') && !txt.includes('submit')) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const data = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
    const ackId = `14${Math.floor(Math.random() * 9000000 + 1000000)}`;
    data.acknowledgementId = ackId;
    sessionStorage.setItem('loanJourneyData', JSON.stringify(data));
    // eslint-disable-next-line no-console
    console.info(`[Journey] Loan submitted, ackId: ${ackId}`);
    window.location.href = getEDSUrl('/personal-loan-thankyou');
  }, true);
}

function initWelcomePageLayout() {
  if (!window.location.pathname.includes('otp-login')) return;
  function applyLayout() {
    const form = document.querySelector('main .form form');
    if (!form) return;
    const mobileWrapper = form.querySelector('input[type="tel"], input[name*="mobile"]')?.closest('.field-wrapper');
    const radioGroups = [...form.querySelectorAll('fieldset.radio-group-wrapper')];
    if (!mobileWrapper || radioGroups.length < 2) return;

    mobileWrapper.style.gridColumn = '1 / span 4';
    mobileWrapper.style.gridRow = '2';
    radioGroups[0].style.gridColumn = '5 / span 4';
    radioGroups[0].style.gridRow = '2';
    radioGroups[1].style.gridColumn = '9 / span 4';
    radioGroups[1].style.gridRow = '2';
  }
  applyLayout();
  setTimeout(applyLayout, 800);
  setTimeout(applyLayout, 2000);
}

function initWelcomePageValidation() {
  const path = window.location.pathname;
  if (!path.includes('personal-loan-welcome') && !path.includes('otp-login')) return;

  function getMobileInput() {
    return document.querySelector('input[name="aadhaar_mobile_number"]')
      || document.querySelector('input[name*="mobile" i]:not([type="radio"])')
      || document.querySelector('input[type="tel"]');
  }

  function getPanInput() {
    return document.querySelector('input[name="pan_card_number"]')
      || document.querySelector('input[name*="pan" i]:not([type="radio"]):not([type="checkbox"])');
  }

  function getDobInput() {
    return document.querySelector('input[type="date"]')
      || document.querySelector('input[name="dob_input"]')
      || document.querySelector('input[name*="dob" i]:not([type="radio"])');
  }

  function showError(input, message) {
    const wrapper = input.closest('.field-wrapper');
    if (!wrapper) return false;
    let errEl = wrapper.querySelector('.wv-field-error');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'wv-field-error';
      wrapper.appendChild(errEl);
    }
    errEl.textContent = message;
    errEl.style.display = 'block';
    input.classList.add('wv-input-invalid');
    wrapper.classList.add('wv-has-error');
    if (wrapper.classList.contains('field-mobileno')) {
      const sib = wrapper.nextElementSibling;
      if (sib) sib.style.display = 'none';
    }
    return false;
  }

  function clearError(input) {
    const wrapper = input.closest('.field-wrapper');
    if (!wrapper) return;
    const errEl = wrapper.querySelector('.wv-field-error');
    if (errEl) errEl.style.display = 'none';
    input.classList.remove('wv-input-invalid');
    wrapper.classList.remove('wv-has-error');
    if (wrapper.classList.contains('field-mobileno')) {
      const sib = wrapper.nextElementSibling;
      if (sib) sib.style.display = '';
    }
  }

  function validatePan(input) {
    const val = (input.value || '').trim();
    if (!val) return showError(input, 'Please fill the field.');
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) return showError(input, 'Enter valid PAN number.');
    clearError(input);
    return true;
  }

  function validateDob(input) {
    const val = input.value;
    if (!val) return showError(input, 'Please fill the field.');
    const dob = new Date(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dob > today) return showError(input, 'Date of birth cannot be in the future.');
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
    if (age < 21) return showError(input, 'You must be at least 21 years old to apply.');
    if (age > 60) return showError(input, 'Age must not exceed 60 years.');
    clearError(input);
    return true;
  }

  function isVisible(input) {
    const wrapper = input.closest('.field-wrapper');
    return wrapper ? wrapper.style.display !== 'none' : true;
  }

  function getSubmitBtn() {
    const form = document.querySelector('main .form form');
    if (!form) return null;
    return form.querySelector('button[type="submit"]')
      || form.querySelector('.field-button button')
      || form.querySelector('.field-submit button')
      || [...form.querySelectorAll('button')].find((b) => /loan|eligib|continu|generate|otp/i.test(b.textContent));
  }

  function isMobileValid() {
    const mob = getMobileInput();
    return mob && /^[6-9]\d{9}$/.test((mob.value || '').trim());
  }

  function isIdFieldValid() {
    const p = getPanInput();
    const d = getDobInput();
    if (p && isVisible(p)) {
      return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test((p.value || '').trim());
    }
    if (d && isVisible(d)) {
      const dv = d.value;
      if (!dv) return false;
      const dob = new Date(dv);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dob > today) return false;
      let age = today.getFullYear() - dob.getFullYear();
      const mo = today.getMonth() - dob.getMonth();
      if (mo < 0 || (mo === 0 && today.getDate() < dob.getDate())) age -= 1;
      return age >= 21 && age <= 60;
    }
    return false;
  }

  function updateSubmitBtn() {
    const btn = getSubmitBtn();
    if (!btn) return;
    const enabled = isMobileValid() && isIdFieldValid();
    btn.disabled = !enabled;
    btn.classList.toggle('wv-btn-disabled', !enabled);
  }

  function attachValidation() {
    const mobileInput = getMobileInput();
    const panInput = getPanInput();
    const dobInput = getDobInput();

    if (mobileInput && !mobileInput.dataset.wvValidation) {
      mobileInput.dataset.wvValidation = 'true';
      mobileInput.removeAttribute('minlength');
      mobileInput.addEventListener('invalid', (e) => e.preventDefault());
      mobileInput.addEventListener('input', () => {
        let val = mobileInput.value.replace(/[^0-9]/g, '');
        if (val.length > 0 && parseInt(val[0], 10) < 6) val = val.slice(1);
        if (val.length > 10) val = val.slice(0, 10);
        mobileInput.value = val;
        clearError(mobileInput);
        updateSubmitBtn();
      });
      mobileInput.addEventListener('blur', () => {
        const val = (mobileInput.value || '').trim();
        if (!val) { clearError(mobileInput); updateSubmitBtn(); return; }
        if (val.length < 10) {
          showError(mobileInput, 'Please enter full 10 digit number.');
        } else if (!/^[6-9]\d{9}$/.test(val)) {
          showError(mobileInput, 'Enter valid India number.');
        } else {
          clearError(mobileInput);
        }
        updateSubmitBtn();
      });
    }

    if (panInput && !panInput.dataset.wvValidation) {
      panInput.dataset.wvValidation = 'true';
      panInput.addEventListener('invalid', (e) => e.preventDefault());
      panInput.addEventListener('input', () => {
        panInput.value = panInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
        updateSubmitBtn();
      });
      panInput.addEventListener('blur', () => { validatePan(panInput); updateSubmitBtn(); });
    }

    if (dobInput && !dobInput.dataset.wvValidation) {
      dobInput.dataset.wvValidation = 'true';
      const todayD = new Date();
      const [maxDob] = new Date(todayD.getFullYear() - 21, todayD.getMonth(), todayD.getDate()).toISOString().split('T');
      const [minDob] = new Date(todayD.getFullYear() - 60, todayD.getMonth(), todayD.getDate()).toISOString().split('T');
      dobInput.max = maxDob;
      dobInput.min = minDob;
      dobInput.addEventListener('invalid', (e) => e.preventDefault());
      dobInput.addEventListener('blur', () => { validateDob(dobInput); updateSubmitBtn(); });
      dobInput.addEventListener('change', () => { validateDob(dobInput); updateSubmitBtn(); });
    }

    // Re-evaluate button when PAN/DOB radio switches
    document.addEventListener('change', (e) => {
      if (e.target.type === 'radio') updateSubmitBtn();
    });

    // Disable button initially
    updateSubmitBtn();

    // Intercept submit — block if any visible field is invalid
    const form = document.querySelector('main .form form');
    if (form) form.setAttribute('novalidate', '');
    if (form && !form.dataset.wvValidation) {
      form.dataset.wvValidation = 'true';
      form.addEventListener('submit', (e) => {
        const p = getPanInput();
        const d = getDobInput();
        const pOk = !p || !isVisible(p) || validatePan(p);
        const dOk = !d || !isVisible(d) || validateDob(d);
        if (!pOk || !dOk) e.preventDefault();
      }, true);
    }
  }

  attachValidation();
  setTimeout(() => { attachValidation(); updateSubmitBtn(); }, 800);
  setTimeout(() => { attachValidation(); updateSubmitBtn(); }, 2500);
}

function initPanDobToggle() {
  const path = window.location.pathname;
  if (!path.includes('personal-loan-welcome') && !path.includes('otp-login')) return;
  if (document.querySelector('.form.edit-mode, .form-block.edit-mode')) return;

  function getPanWrapper() {
    return (
      document.querySelector('input[name="pan_card_number"]')?.closest('.field-wrapper')
      || document.querySelector('input[name*="pan" i]:not([type="radio"]):not([type="checkbox"])')
        ?.closest('.field-wrapper')
      || [...document.querySelectorAll('.field-wrapper')]
        .find((w) => /pan\s*card\s*number/i.test(w.querySelector('label')?.textContent || ''))
    );
  }

  function getDobWrapper() {
    return (
      document.querySelector('input[type="date"]')?.closest('.field-wrapper')
      || document.querySelector('input[name="dob_input"]')?.closest('.field-wrapper')
      || document.querySelector('input[name*="dob" i]:not([type="radio"]):not([type="checkbox"])')
        ?.closest('.field-wrapper')
      || [...document.querySelectorAll('.field-wrapper')]
        .find((w) => /date\s*of\s*birth/i.test(w.querySelector('label')?.textContent || ''))
    );
  }

  // Attach a single delegated listener — only react to the PAN/DOB identifier radio
  document.addEventListener('change', (e) => {
    const radio = e.target;
    if (radio.type !== 'radio') return;
    // Ignore income-type and other radios; only handle the PAN vs DOB selector
    const val = radio.value || '';
    const labelText = radio.closest('label')?.textContent || radio.closest('.field-wrapper')?.querySelector('label')?.textContent || '';
    const isIdTypeRadio = /pan|dob|date.*birth|birth.*date/i.test(val)
      || /pan|dob|date.*birth/i.test(labelText);
    if (!isIdTypeRadio) return;
    const panWrapper = getPanWrapper();
    const dobWrapper = getDobWrapper();
    if (!panWrapper || !dobWrapper) return;
    const isPan = /pan/i.test(val);
    panWrapper.style.display = isPan ? '' : 'none';
    dobWrapper.style.display = isPan ? 'none' : '';
  });

  // Uncheck income-type radio (Salaried / Self Employed) — no default selection per design
  let incomeCleared = false;
  function clearIncomeDefault() {
    if (incomeCleared) return;
    const salariedRadio = [...document.querySelectorAll('input[type="radio"]')]
      .find((r) => /salaried/i.test(r.value));
    if (!salariedRadio) return;
    incomeCleared = true;
    const group = salariedRadio.closest('fieldset') || salariedRadio.parentElement;
    group.querySelectorAll('input[type="radio"]').forEach((r) => { r.checked = false; });
  }

  // Apply initial state once the form has rendered (retry until fields exist)
  let initialized = false;
  function applyInitialVisibility() {
    if (initialized) return;
    const panWrapper = getPanWrapper();
    const dobWrapper = getDobWrapper();
    if (!panWrapper || !dobWrapper) return;
    initialized = true;
    const checked = document.querySelector('input[type="radio"]:checked');
    // Default: show DOB, hide PAN (per PDF design); if PAN radio is already checked, show PAN
    const isPan = checked ? /pan/i.test(checked.value) : false;
    panWrapper.style.display = isPan ? '' : 'none';
    dobWrapper.style.display = isPan ? 'none' : '';
  }

  applyInitialVisibility();
  clearIncomeDefault();
  setTimeout(() => { applyInitialVisibility(); clearIncomeDefault(); }, 800);
  setTimeout(() => { applyInitialVisibility(); clearIncomeDefault(); }, 2000);
}

function initOTPLoginFragmentEnhancements() {
  function run() {
    const panel = document.querySelector('main .form form .field-personal-loan-offer-introduction');
    if (!panel) return;

    // Income verification note — show when Salaried is selected
    const verificationNote = panel.querySelector('.field-income-verification-note');
    if (verificationNote && !verificationNote.dataset.toggleInit) {
      // eslint-disable-next-line no-param-reassign
      verificationNote.dataset.toggleInit = 'true';
      const updateNote = () => {
        const checked = panel.querySelector('.field-income-source input[type="radio"]:checked');
        const isSalaried = checked && /salaried/i.test(checked.value);
        // eslint-disable-next-line no-param-reassign
        verificationNote.style.display = isSalaried ? 'block' : 'none';
      };
      panel.addEventListener('change', (e) => { if (e.target.type === 'radio') updateNote(); });
      updateNote();
    }
  }

  run();
  setTimeout(run, 800);
  setTimeout(run, 2500);
}

function initThankYouPageHandlers() {
  if (!window.location.pathname.includes('personal-loan-thankyou')) return;

  const clipboardSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>';
  const downloadSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

  function run() {
    // Build icon + label + number row so icon is vertically centered with both
    const legend = document.querySelector('.field-loan-application-summary-panel > legend');
    const fieldset = legend ? legend.closest('fieldset') : null;
    const numEl = fieldset ? fieldset.querySelector('.field-loan-application-number p') : null;
    if (legend && fieldset && numEl && !fieldset.querySelector('.ty-app-number-row')) {
      const row = document.createElement('div');
      row.className = 'ty-app-number-row';
      row.innerHTML = `<span class="ty-legend-icon">${clipboardSvg}</span><div class="ty-app-number-text"><span class="ty-app-label">${legend.textContent.trim()}</span><span class="ty-app-value">${numEl.textContent.trim()}</span></div>`;
      legend.style.display = 'none';
      const numWrapper = numEl.closest('.field-loan-application-number');
      if (numWrapper) numWrapper.style.display = 'none';
      fieldset.prepend(row);
    }

    // Replace easy loan management legend with inner header div (download icon, fix border-notch)
    const easyLegend = document.querySelector('.field-easy-loan-management-panel > legend');
    const easyFieldset = easyLegend ? easyLegend.closest('fieldset') : null;
    if (easyLegend && easyFieldset && !easyFieldset.querySelector('.ty-easy-loan-header')) {
      const header = document.createElement('div');
      header.className = 'ty-easy-loan-header';
      header.innerHTML = `<span class="ty-easy-icon">${downloadSvg}</span><span>${easyLegend.textContent.trim()}</span>`;
      easyLegend.style.display = 'none';
      easyFieldset.prepend(header);
    }

    // Split "Loan Amount ₹15,00,000" into label + value lines
    const loanAmountP = document.querySelector('.field-loan-amount p');
    if (loanAmountP && !loanAmountP.querySelector('.ty-label')) {
      const text = loanAmountP.textContent || '';
      const rupeeIdx = text.indexOf('₹');
      if (rupeeIdx > 0) {
        const label = text.substring(0, rupeeIdx).trim();
        const value = text.substring(rupeeIdx).trim();
        loanAmountP.innerHTML = `<span class="ty-label">${label}</span><span class="ty-value">${value}</span>`;
      }
    }
  }

  run();
  setTimeout(run, 800);
  setTimeout(run, 2500);
}

function initWelcomePageIcons() {
  const svgIcons = {
    '.field-essential-mobile': '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>',
    '.field-essential-pan': '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    '.field-essential-dob': '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    '.field-essential-cheque': '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  };

  function injectIcons() {
    Object.entries(svgIcons).forEach(([selector, svg]) => {
      const el = document.querySelector(selector);
      if (!el || el.querySelector('.essential-icon')) return;
      const span = document.createElement('span');
      span.className = 'essential-icon';
      span.innerHTML = svg;
      el.prepend(span);
    });
  }

  function injectPhonePrefix() {
    const mobileInput = document.querySelector(
      'input[name="aadhaar_mobile_number"],'
      + ' input[name*="mobile"][type="tel"],'
      + ' input[type="tel"]',
    );
    if (!mobileInput || mobileInput.closest('.phone-prefix-wrapper')) return;
    const inputParent = mobileInput.parentElement;
    const wrapper = document.createElement('div');
    wrapper.className = 'phone-prefix-wrapper';
    const prefix = document.createElement('span');
    prefix.className = 'phone-flag-prefix';
    prefix.textContent = '🇮🇳 +91';
    inputParent.insertBefore(wrapper, mobileInput);
    wrapper.appendChild(prefix);
    wrapper.appendChild(mobileInput);
  }

  injectIcons();
  injectPhonePrefix();
  setTimeout(() => { injectIcons(); injectPhonePrefix(); }, 500);
  setTimeout(() => { injectIcons(); injectPhonePrefix(); }, 1500);
  setTimeout(() => { injectIcons(); injectPhonePrefix(); }, 3000);
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
  const slug = window.location.pathname.split('/').pop().replace('.html', '');
  if (slug) document.body.classList.add(`page-${slug}`);
  initLoanJourneyHandlers();
  initOTPPageHandlers();
  initOfferPageHandlers();
  initPreviewPageHandlers();
  initWelcomePageLayout();
  initPanDobToggle();
  initWelcomePageValidation();
  initOTPLoginFragmentEnhancements();
  initWelcomePageIcons();
  initThankYouPageHandlers();
}

loadPage();
