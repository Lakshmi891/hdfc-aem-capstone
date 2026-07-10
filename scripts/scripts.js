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
    ? `${AEM_AUTHOR_FORMS_BASE}${path}.html`
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
    customerAddress1: 'B/H Fame Theatre 21, Shri Ram Bungalow, Kalpataru Nagar, Ashoka Colony, Kharar (West)',
    customerCity: 'Mumbai',
    customerState: 'Maharashtra',
    zipCode: '422022',
    emailAddress: 'ankit@gmail.com',
    offerAmount: '1000000.00',
    tenure: '36',
    rateOfInterest: '10.20',
    kycFlag: 'Y',
    accountNumber: 'XX50151',
    customerID: 'XX12345',
    employerName: 'Adobe Systems',
    industryType: 'IT',
    workEmail: 'ankit@adobe.com',
    netMonthlyIncome: '50000',
    ongoingEmi: '0',
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
    window.location.href = getEDSUrl('/personal-loan-info');
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
    const headerEl = document.querySelector('.field-offer-summary-header');
    if (headerEl) {
      let amountP = [...headerEl.querySelectorAll('p')].find((p) => /^₹/.test(p.textContent.trim()));
      if (!amountP) {
        amountP = document.createElement('p');
        headerEl.appendChild(amountP);
      }
      amountP.textContent = fmtINR(P);
    }
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

function initPersonalInfoPageHandlers() {
  // SVG icon strings matched to UX design: person, ID card, contact form, home,
  // office building, Indian rupee (₹), envelope, document/loan
  const panelSvgIcons = {
    // Customer Details – person silhouette
    'field-personal-info': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    // Full Name as per PAN – ID card with name lines
    'field-full-name-as-per-pan': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M13 10h5M13 14h4"/></svg>',
    // Personal Details – user with lines (contact record)
    'field-personal-details': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    // Address Details – location pin
    'field-address-details': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    // Employer Details – office building
    'field-employer-details-panel': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 21h18"/><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
    // Income Details – wallet
    'field-income-details-panel': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><circle cx="17" cy="15" r="1" fill="currentColor"/></svg>',
    // Work Email ID – envelope
    'field-work-email-id-panel': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    // Type of Loan – bank / institution building
    'field-type-of-loan-panel': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 22h18"/><path d="M2 7l10-5 10 5"/><rect x="5" y="7" width="2" height="13"/><rect x="11" y="7" width="2" height="13"/><rect x="17" y="7" width="2" height="13"/><line x1="2" y1="7" x2="22" y2="7"/></svg>',
  };

  const collapsiblePanels = [
    'field-employer-details-panel',
    'field-income-details-panel',
    'field-work-email-id-panel',
    'field-type-of-loan-panel',
  ];

  function run() {
    if (!document.querySelector('.field-personal-info')) return;

    // Add scoping class so CSS selectors are reliable (avoids :has() hydration timing issues)
    const form = document.querySelector('.field-personal-info')?.closest('form');
    if (form && !form.classList.contains('personal-info-form')) {
      form.classList.add('personal-info-form');
    }

    // Pre-populate Customer Details name from sessionStorage (set during OTP verification).
    // Fallback to mock so the field shows during direct-page testing.
    const journeyData = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
    const offer = journeyData.offerDemogDetails || {};
    const firstName = offer.customerFirstName || 'Ankit';
    const lastName = offer.customerLastName || 'Enterprises';
    const fullName = journeyData.customerName || [firstName, lastName].filter(Boolean).join(' ') || 'Ankit Enterprises';

    // Inject a visible <span> for the name so the display is immune to AEM model re-renders.
    // Also set input.value so the value is present for any form submission logic.
    const fullNameWrapper = document.querySelector('.field-personal-info .field-customer-full-name');
    if (fullNameWrapper && !fullNameWrapper.querySelector('.pi-display-name')) {
      const nameSpan = document.createElement('span');
      nameSpan.className = 'pi-display-name';
      nameSpan.textContent = fullName;
      const nameInput = fullNameWrapper.querySelector('input');
      if (nameInput) {
        nameInput.value = fullName;
        nameInput.after(nameSpan);
      } else {
        fullNameWrapper.append(nameSpan);
      }
    }

    // Pre-populate Full Name (As per PAN) first/last name fields
    const panFirstInput = document.querySelector('.field-pan-first-name input');
    const panLastInput = document.querySelector('.field-pan-last-name input');
    if (panFirstInput && !panFirstInput.value) {
      panFirstInput.value = firstName;
      panFirstInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (panLastInput && !panLastInput.value) {
      panLastInput.value = lastName;
      panLastInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Pre-fill PAN Number from what the user entered on the welcome page
    const panNumberInput = document.querySelector('.field-personal-details .field-pan-number input');
    const panNumber = journeyData.pan || '';
    if (panNumberInput && !panNumberInput.value && panNumber) {
      panNumberInput.value = panNumber;
      panNumberInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Pre-fill Aadhaar address from journey/offer data (with mock fallbacks for direct page access)
    const aadhaarAddressInput = document.querySelector('.field-address-details .field-aadhaar-address input, .field-address-details .field-aadhaar-address textarea');
    if (aadhaarAddressInput && !aadhaarAddressInput.value) {
      const addr1 = offer.customerAddress1 || 'B/H Fame Theatre 21, Shri Ram Bungalow, Kalpataru Nagar, Ashoka Colony, Kharar (West)';
      const city = offer.customerCity || 'Mumbai';
      const zip = offer.zipCode || '422022';
      const fullAddress = `${addr1}, ${city} - ${zip}`;
      aadhaarAddressInput.value = fullAddress;
      aadhaarAddressInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Pre-fill Monthly Net Income (Salary) with mock fallback
    const salaryInput = document.querySelector('.field-income-details-panel .field-monthly-net-income-salary input')
      || document.querySelector('.field-income-details-panel .field-monthly-net-income input')
      || document.querySelector('.field-income-details-panel .field-monthly-salary input')
      || document.querySelector('.field-income-details-panel div.number-wrapper input, .field-income-details-panel div.text-wrapper input');
    if (salaryInput && !salaryInput.value) {
      salaryInput.value = offer.netMonthlyIncome || '50000';
      salaryInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Pre-fill Ongoing EMIs with 0
    const emiInput = document.querySelector('.field-income-details-panel .field-ongoing-emis input, .field-income-details-panel .field-ongoing-emis-if-any input');
    if (emiInput && !emiInput.value) {
      emiInput.value = offer.ongoingEmi !== undefined ? offer.ongoingEmi : '0';
      emiInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Pre-fill Enter Employer/Company Name text input
    // Try specific class names, then fall back to the first plain text input in the panel
    const employerTextInput = document.querySelector('.field-employer-details-panel .field-enter-employer-company-name input')
      || document.querySelector('.field-employer-details-panel .field-enter-company-name input')
      || document.querySelector('.field-employer-details-panel .field-employer-name-text input')
      || document.querySelector('.field-employer-details-panel div.text-wrapper input');
    if (employerTextInput && !employerTextInput.value) {
      employerTextInput.value = offer.employerName || 'Adobe Systems';
      employerTextInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Pre-fill Industry Type (text or select)
    const industryInput = document.querySelector('.field-employer-details-panel .field-industry-type input')
      || document.querySelector('.field-employer-details-panel .field-industry-type select');
    if (industryInput && !industryInput.value) {
      industryInput.value = offer.industryType || 'IT';
      industryInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Pre-fill Work Email ID
    const workEmailInput = document.querySelector('.field-work-email-id-panel .field-work-email-id input');
    if (workEmailInput && !workEmailInput.value) {
      workEmailInput.value = offer.workEmail || 'ankit@adobe.com';
      workEmailInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Pre-fill Type of Loan dropdown — select first non-placeholder option
    const loanTypeSelect = document.querySelector('.field-type-of-loan-panel .field-type-of-loan select, .field-type-of-loan-panel .field-select-loan-type select')
      || document.querySelector('.field-type-of-loan-panel div.drop-down-wrapper select');
    if (loanTypeSelect && !loanTypeSelect.value) {
      const firstOption = [...loanTypeSelect.options].find((o) => o.value && !o.disabled);
      if (firstOption) {
        loanTypeSelect.value = firstOption.value;
        loanTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // "Leave blank if not available on PAN": move hint to bottom of Middle Name wrapper
    // so it appears below the Middle Name input (right column), not beside Last Name.
    const panPanel = document.querySelector('.field-full-name-as-per-pan');
    if (panPanel && !panPanel.querySelector('.pi-pan-hint')) {
      const descEl = panPanel.querySelector('.field-pan-last-name .field-description')
        || panPanel.querySelector('.field-pan-middle-name .field-description');
      const middleWrapper = panPanel.querySelector('.field-pan-middle-name');
      if (descEl && middleWrapper) {
        const hint = document.createElement('div');
        hint.className = 'pi-pan-hint';
        hint.textContent = descEl.textContent;
        descEl.style.display = 'none';
        middleWrapper.appendChild(hint);
      }
    }

    // Inject icon badge into each panel's legend
    Object.entries(panelSvgIcons).forEach(([cls, svgHtml]) => {
      const panel = document.querySelector(`.${cls}`);
      const legend = panel?.querySelector(':scope > legend');
      if (!legend || legend.querySelector('.panel-icon')) return;
      const iconEl = document.createElement('span');
      iconEl.className = 'panel-icon';
      iconEl.innerHTML = svgHtml;
      legend.insertBefore(iconEl, legend.firstChild);
    });

    // Inject ℹ info circle after the title text on non-collapsible, non-external-header panels
    const infoIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    ['field-full-name-as-per-pan'].forEach((cls) => {
      const panel = document.querySelector(`.${cls}`);
      const legend = panel?.querySelector(':scope > legend');
      if (!legend || legend.querySelector('.pi-info-icon')) return;
      const infoEl = document.createElement('span');
      infoEl.className = 'pi-info-icon';
      infoEl.innerHTML = infoIconSvg;
      legend.appendChild(infoEl);
    });

    // Move Verify button inside email wrapper so it appears as an inline action
    const emailWrapper = document.querySelector('.field-personal-details .field-personal-email');
    const verifyWrapper = document.querySelector('.field-personal-details .field-verify-personal-email');
    if (emailWrapper && verifyWrapper && !emailWrapper.querySelector('.verify-inline-btn')) {
      const btn = verifyWrapper.querySelector('button');
      if (btn) {
        btn.classList.add('verify-inline-btn');
        emailWrapper.appendChild(btn);
        verifyWrapper.style.display = 'none';
      }
    }

    // Move Work Email Verify button inline (same pattern as personal email)
    const workEmailWrapper = document.querySelector('.field-work-email-id-panel .field-work-email-id');
    const workVerifyWrapper = document.querySelector('.field-work-email-id-panel .field-verify-work-email-button');
    if (workEmailWrapper && workVerifyWrapper && !workEmailWrapper.querySelector('.verify-inline-btn')) {
      const workBtn = workVerifyWrapper.querySelector('button');
      if (workBtn) {
        workBtn.classList.add('verify-inline-btn');
        workEmailWrapper.appendChild(workBtn);
        workVerifyWrapper.style.display = 'none';
      }
    }

    // Wrap email chips in a single flex div so they sit side-by-side without the grid column gap
    const gmailChip = document.querySelector('.field-email-chip-gmail');
    const outlookChip = document.querySelector('.field-email-chip-outlook');
    const yahooChip = document.querySelector('.field-email-chip-yahoo');
    if (gmailChip && outlookChip && yahooChip && !document.querySelector('.email-chips-row')) {
      const chipsRow = document.createElement('div');
      chipsRow.className = 'email-chips-row';
      gmailChip.parentNode.insertBefore(chipsRow, gmailChip);
      chipsRow.appendChild(gmailChip);
      chipsRow.appendChild(outlookChip);
      chipsRow.appendChild(yahooChip);
    }

    // ---- Email verification flow ----
    (function initEmailVerification() {
      const personalEmailWrapper = document.querySelector('.field-personal-details .field-personal-email');
      if (!personalEmailWrapper || personalEmailWrapper.dataset.emailSetup) return;
      personalEmailWrapper.dataset.emailSetup = '1';

      const emailInput = personalEmailWrapper.querySelector('input');
      const verifyBtn = personalEmailWrapper.querySelector('.verify-inline-btn');
      if (!emailInput || !verifyBtn) return;

      // Pre-fill with <firstName>@gmail.com by default
      if (!emailInput.value) {
        const jd = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
        const fn = (jd.offerDemogDetails?.customerFirstName || 'ankit').toLowerCase();
        emailInput.value = `${fn}@gmail.com`;
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      function resetVerified() {
        personalEmailWrapper.classList.remove('email-verified');
        verifyBtn.style.display = '';
        personalEmailWrapper.querySelector('.pi-email-check')?.remove();
        document.querySelector('.pi-email-success')?.remove();
      }

      function markVerified() {
        personalEmailWrapper.classList.add('email-verified');
        verifyBtn.style.display = 'none';
        if (!personalEmailWrapper.querySelector('.pi-email-check')) {
          const check = document.createElement('span');
          check.className = 'pi-email-check';
          check.textContent = 'Verified';
          personalEmailWrapper.appendChild(check);
        }
      }

      function showSuccess() {
        document.querySelector('.pi-email-success')?.remove();
        const msg = document.createElement('div');
        msg.className = 'pi-email-success';
        msg.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Email sent successfully';
        const chipsRow = document.querySelector('.email-chips-row');
        (chipsRow || personalEmailWrapper).insertAdjacentElement('afterend', msg);
        setTimeout(() => msg?.remove(), 4000);
      }

      verifyBtn.addEventListener('click', () => {
        const val = emailInput.value.trim();
        if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return;
        markVerified();
        showSuccess();
      });

      emailInput.addEventListener('input', resetVerified);

      // Chip clicks: swap domain, keep local part
      document.querySelectorAll('.field-email-chip-gmail p, .field-email-chip-outlook p, .field-email-chip-yahoo p')
        .forEach((chip) => {
          chip.addEventListener('click', () => {
            const domain = chip.textContent.trim().replace('@', '');
            const local = emailInput.value.split('@')[0] || 'user';
            emailInput.value = `${local}@${domain}`;
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            resetVerified();
          });
        });
    }());

    // ---- Work Email verification flow (same pattern as personal email) ----
    (function initWorkEmailVerification() {
      const workEmailWrap = document.querySelector('.field-work-email-id-panel .field-work-email-id');
      if (!workEmailWrap || workEmailWrap.dataset.workEmailSetup) return;
      workEmailWrap.dataset.workEmailSetup = '1';

      const workInput = workEmailWrap.querySelector('input');
      const workVerifyBtn = workEmailWrap.querySelector('.verify-inline-btn');
      if (!workInput || !workVerifyBtn) return;

      function resetWorkVerified() {
        workEmailWrap.classList.remove('email-verified');
        workVerifyBtn.style.display = '';
        workEmailWrap.querySelector('.pi-email-check')?.remove();
        document.querySelector('.pi-work-email-success')?.remove();
      }

      function markWorkVerified() {
        workEmailWrap.classList.add('email-verified');
        workVerifyBtn.style.display = 'none';
        if (!workEmailWrap.querySelector('.pi-email-check')) {
          const check = document.createElement('span');
          check.className = 'pi-email-check';
          check.textContent = 'Verified';
          workEmailWrap.appendChild(check);
        }
      }

      function showWorkSuccess() {
        document.querySelector('.pi-work-email-success')?.remove();
        const msg = document.createElement('div');
        msg.className = 'pi-work-email-success';
        msg.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Email sent successfully';
        workEmailWrap.insertAdjacentElement('afterend', msg);
        setTimeout(() => msg?.remove(), 4000);
      }

      workVerifyBtn.addEventListener('click', () => {
        const val = workInput.value.trim();
        if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return;
        markWorkVerified();
        showWorkSuccess();
      });

      workInput.addEventListener('input', resetWorkVerified);
    }());

    // Customer Details: external header div placed BEFORE the fieldset (above the card)
    ['field-personal-info'].forEach((cls) => {
      const panel = document.querySelector(`.${cls}`);
      if (!panel || panel.previousElementSibling?.classList.contains('panel-external-header')) return;
      const legend = panel.querySelector(':scope > legend');
      if (!legend) return;

      const header = document.createElement('div');
      header.className = 'panel-external-header';
      header.innerHTML = legend.innerHTML;
      panel.parentNode.insertBefore(header, panel);
      legend.hidden = true;
    });

    // Address Details: internal header div inserted as FIRST CHILD inside the card
    // (<legend> always renders above the fieldset border — a div stays inside)
    // Build from scratch so we always use our own icon regardless of what AEM put in the legend
    const addrPanel = document.querySelector('.field-address-details');
    if (addrPanel && !addrPanel.querySelector('.panel-internal-header')) {
      const addrLegend = addrPanel.querySelector(':scope > legend');
      if (addrLegend) {
        const internalHeader = document.createElement('div');
        internalHeader.className = 'panel-internal-header';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'panel-icon';
        iconSpan.innerHTML = panelSvgIcons['field-address-details'];
        internalHeader.appendChild(iconSpan);
        const legendClone = addrLegend.cloneNode(true);
        legendClone.querySelector('.panel-icon')?.remove();
        internalHeader.appendChild(document.createTextNode(legendClone.textContent.trim()));
        addrPanel.insertBefore(internalHeader, addrPanel.firstChild);
        addrLegend.hidden = true;
      }
    }

    // Wire collapsible toggle behaviour
    collapsiblePanels.forEach((cls) => {
      const panel = document.querySelector(`.${cls}`);
      if (!panel) return;
      panel.classList.add('collapsible');
      const legend = panel.querySelector(':scope > legend');
      if (!legend) return;
      legend.addEventListener('click', () => {
        const isCollapsed = panel.getAttribute('data-collapsed') === 'true';
        panel.setAttribute('data-collapsed', String(!isCollapsed));
      });
    });

    // Move Back + Confirm buttons outside the Type of Loan panel so they sit at form level
    const typeOfLoanPanel = document.querySelector('.field-type-of-loan-panel');
    const confirmBtnWrapper = document.querySelector('.field-confirm-button');
    const backBtnWrapper = document.querySelector('.field-back-button');
    if (typeOfLoanPanel && confirmBtnWrapper && typeOfLoanPanel.contains(confirmBtnWrapper)) {
      if (backBtnWrapper) {
        typeOfLoanPanel.insertAdjacentElement('afterend', backBtnWrapper);
        backBtnWrapper.insertAdjacentElement('afterend', confirmBtnWrapper);
      } else {
        typeOfLoanPanel.insertAdjacentElement('afterend', confirmBtnWrapper);
      }
    }

    // Confirm button → navigate to Get Bureau page
    const confirmBtn = document.querySelector('.field-confirm-button button');
    if (confirmBtn && !confirmBtn.dataset.infoSetup) {
      confirmBtn.dataset.infoSetup = '1';
      confirmBtn.type = 'button';
      confirmBtn.addEventListener('click', () => {
        window.location.href = getEDSUrl('/get-bureau');
      });
    }
  }

  // Run as soon as the form fieldset appears — avoids the 1.5 s FOUC from a fixed timeout
  const target = document.querySelector('.field-personal-info');
  if (target) {
    run();
    return;
  }
  const obs = new MutationObserver(() => {
    if (document.querySelector('.field-personal-info')) {
      obs.disconnect();
      run();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  // Safety fallback in case the observer never fires
  setTimeout(() => { obs.disconnect(); run(); }, 3000);
}

function initGetBureauPageHandlers() {
  if (!window.location.pathname.includes('get-bureau')) return;

  // Colored brand tiles — short brand text inside box, full name stays in label below
  const bankTiles = {
    hdfc: '/icons/hdfc.png',
    icici: '/icons/icic.png',
    axis: '/icons/axis.png',
    kotak: '/icons/kotak.png',
    sbi: '/icons/sbi.png',
    bob: '/icons/baroda.png',
    idfc: '/icons/idfc.png',
  };

  const methodDescriptions = {
    account_aggregator: 'Instant & secure, processed via RBI-regulated partner.',
    login_salary_account: 'Quick & hassle-free, processed via NetBanking.',
    upload_bank_statement: 'Processed via uploading bank statement of the last 6 months.',
  };

  const bankIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 22h18"/><path d="M2 7l10-5 10 5"/><rect x="5" y="7" width="2" height="13"/><rect x="11" y="7" width="2" height="13"/><rect x="17" y="7" width="2" height="13"/><line x1="2" y1="7" x2="22" y2="7"/></svg>';
  const incomeVerifyIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>';
  const checkSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const arrowSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:middle"><polyline points="9 18 15 12 9 6"/></svg>';

  function addLegendIcon(panel, svgHtml) {
    const legend = panel.querySelector(':scope > legend');
    if (!legend || legend.querySelector('.bureau-panel-icon')) return;
    const icon = document.createElement('span');
    icon.className = 'bureau-panel-icon';
    icon.innerHTML = svgHtml;
    legend.prepend(icon);
  }

  function setupBankCards() {
    const bankGroup = document.querySelector('.field-bank-selection');
    if (!bankGroup || bankGroup.dataset.bureauBankSetup) return;
    bankGroup.dataset.bureauBankSetup = '1';

    bankGroup.querySelectorAll('.radio-wrapper').forEach((wrapper) => {
      const input = wrapper.querySelector('input[type="radio"]');
      const label = wrapper.querySelector('label');
      if (!input || !label) return;
      const val = input.value;

      if (val === 'other') {
        wrapper.classList.add('other-bank-wrapper');
        if (!wrapper.querySelector('.other-bank-dropdown')) {
          const otherBankList = ['Union Bank of India', 'Punjab National Bank'];

          const dropdown = document.createElement('div');
          dropdown.className = 'other-bank-dropdown';

          const trigger = document.createElement('div');
          trigger.className = 'other-bank-trigger';
          trigger.innerHTML = `<span class="other-bank-text">Other Bank</span><span class="other-bank-chevron"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>`;

          const menu = document.createElement('ul');
          menu.className = 'other-bank-menu';
          otherBankList.forEach((name) => {
            const li = document.createElement('li');
            li.className = 'other-bank-option';
            li.textContent = name;
            li.addEventListener('click', (e) => {
              e.stopPropagation();
              trigger.querySelector('.other-bank-text').textContent = name;
              dropdown.classList.remove('open');
              input.value = name.toLowerCase().replace(/\s+/g, '_');
            });
            menu.appendChild(li);
          });

          trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
          });

          document.addEventListener('click', () => dropdown.classList.remove('open'));

          dropdown.appendChild(trigger);
          dropdown.appendChild(menu);
          label.textContent = '';
          label.style.display = 'none';
          wrapper.appendChild(dropdown);
        }
        return;
      }

      if (!wrapper.querySelector('.bank-logo-icon')) {
        const logoSrc = bankTiles[val];
        const bankNameText = label.textContent.trim();

        const iconEl = document.createElement('span');
        iconEl.className = 'bank-logo-icon';

        if (logoSrc) {
          const img = document.createElement('img');
          img.src = logoSrc;
          img.alt = bankNameText;
          img.onerror = () => {
            img.remove();
            iconEl.textContent = bankNameText.slice(0, 4).toUpperCase();
            iconEl.style.fontSize = '0.65rem';
            iconEl.style.fontWeight = '700';
            iconEl.style.color = '#374151';
          };
          iconEl.appendChild(img);
        } else {
          iconEl.textContent = bankNameText.slice(0, 4).toUpperCase();
        }

        label.textContent = '';
        label.appendChild(iconEl);

        const nameEl = document.createElement('span');
        nameEl.className = 'bank-name';
        nameEl.textContent = bankNameText;
        nameEl.addEventListener('click', () => input.click());
        wrapper.appendChild(nameEl);
      }

      if (!wrapper.querySelector('.bank-check-badge')) {
        const badge = document.createElement('span');
        badge.className = 'bank-check-badge';
        badge.innerHTML = checkSvg;
        const lbl = wrapper.querySelector('label');
        if (lbl) lbl.appendChild(badge);
      }
    });
  }

  function setupIncomeCards() {
    const methodGroup = document.querySelector('.field-income-verification-method');
    if (!methodGroup || methodGroup.dataset.bureauIncomeSetup) return;
    methodGroup.dataset.bureauIncomeSetup = '1';

    methodGroup.querySelectorAll('.radio-wrapper').forEach((wrapper) => {
      const input = wrapper.querySelector('input[type="radio"]');
      const label = wrapper.querySelector('label');
      if (!input || !label) return;
      const val = input.value;

      if (!wrapper.querySelector('.card-title')) {
        const titleText = label.textContent.trim();
        label.textContent = '';
        const title = document.createElement('span');
        title.className = 'card-title';
        title.textContent = titleText;
        label.appendChild(title);
      }

      if (!wrapper.querySelector('.card-desc')) {
        const descEl = document.createElement('p');
        descEl.className = 'card-desc';
        descEl.textContent = methodDescriptions[val] || '';
        wrapper.appendChild(descEl);
      }

      if (val === 'account_aggregator' && !wrapper.querySelector('.card-recommended')) {
        const badge = document.createElement('div');
        badge.className = 'card-recommended';
        badge.textContent = 'Recommended';
        wrapper.appendChild(badge);
      }
    });

    const aaInput = methodGroup.querySelector('input[value="account_aggregator"]');
    if (aaInput && !aaInput.checked) {
      aaInput.checked = true;
    }
  }

  function setupContinueButton() {
    const btn = document.querySelector('.field-continue-button button');
    if (!btn || btn.dataset.bureauSetup) return;
    btn.dataset.bureauSetup = '1';
    // eslint-disable-next-line no-param-reassign
    btn.type = 'button';
    btn.innerHTML = `Continue ${arrowSvg}`;
    btn.addEventListener('click', () => {
      const selectedBank = document.querySelector('input[name="bank_selection"]:checked')?.value;
      const selectedMethod = document.querySelector('input[name="income_verification_method"]:checked')?.value;
      try {
        const data = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
        data.selectedBank = selectedBank;
        data.incomeVerificationMethod = selectedMethod;
        sessionStorage.setItem('loanJourneyData', JSON.stringify(data));
      } catch (err) { /* ignore */ }
      window.location.href = getEDSUrl('/personal-loan-offer');
    });
  }

  function run() {
    const bankPanel = document.querySelector('.field-select-bank-panel');
    if (!bankPanel) return;

    const form = bankPanel.closest('form');
    if (form && !form.classList.contains('get-bureau-form')) {
      form.classList.add('get-bureau-form');
    }

    addLegendIcon(bankPanel, bankIconSvg);
    const incomePanel = document.querySelector('.field-income-verification-panel');
    if (incomePanel) addLegendIcon(incomePanel, incomeVerifyIconSvg);

    setupBankCards();
    setupIncomeCards();
    setupContinueButton();
  }

  const initial = document.querySelector('.field-select-bank-panel');
  if (initial) { run(); return; }
  const obs = new MutationObserver(() => {
    if (document.querySelector('.field-select-bank-panel')) {
      obs.disconnect();
      run();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => { obs.disconnect(); run(); }, 3000);
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
  initPersonalInfoPageHandlers();
  initGetBureauPageHandlers();
}

loadPage();
