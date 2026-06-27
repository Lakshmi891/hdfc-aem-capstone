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

    const mobile = (document.querySelector('input[name="aadhaar_mobile_number"]')?.value || '').trim();
    const idTypeEl = document.querySelector('input[name="id_type"]:checked');
    const idType = idTypeEl ? idTypeEl.value : 'Pan Card';
    const pan = (document.querySelector('input[name="pan_card_number"]')?.value || '').trim().toUpperCase();
    const dob = (document.querySelector('input[name="dob_input"]')?.value || '').trim();

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      const errEl = document.querySelector('input[name="otp_instruction"]') || document.querySelector('[name="otp_instruction"]');
      if (errEl) errEl.value = 'Please enter a valid 10-digit mobile number.';
      return;
    }

    if (idType === 'Pan Card' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
      const errEl = document.querySelector('input[name="otp_instruction"]') || document.querySelector('[name="otp_instruction"]');
      if (errEl) errEl.value = 'Please enter a valid PAN (e.g. ABCDE1234F).';
      return;
    }

    if (idType === 'Date of Birth' && !dob) {
      const errEl = document.querySelector('input[name="otp_instruction"]') || document.querySelector('[name="otp_instruction"]');
      if (errEl) errEl.value = 'Please enter your Date of Birth.';
      return;
    }

    try {
      const journeyId = `PJ_${Date.now()}`;
      const data = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
      data.partnerJourneyID = journeyId;
      data.bankJourneyID = `BJ_${Date.now()}`;
      data.identifierName = idType === 'Pan Card' ? 'PAN_NO' : 'DOB';
      data.identifierValue = idType === 'Pan Card' ? pan : dob;
      data.mobileNo = mobile;
      data.mockOTP = Math.floor(100000 + Math.random() * 900000).toString();
      sessionStorage.setItem('loanJourneyData', JSON.stringify(data));
      window.location.href = getEDSUrl('/personal-loan-otp');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Journey] Failed to initiate:', err);
    }
  });
}

let otpTimerActive = false;
let otpTimerInterval = null;

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
  };

  function getJourneyData() {
    return JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
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

  // Finds timer element: any element type with that name, then text-content fallback
  function findTimerEl() {
    return (
      document.querySelector('[name="resend_otp_timer"]')
      || [...document.querySelectorAll('p, span, button, div, input, label')]
        .find((el) => el.childElementCount === 0 && /resend\s+otp/i.test(elText(el)))
    );
  }

  // Finds attempts element: any element type with that name, then text-content fallback
  function findAttemptsEl() {
    return (
      document.querySelector('[name="attempts_left"]')
      || [...document.querySelectorAll('p, span, div, label, input')]
        .find((el) => el.childElementCount === 0 && /attempt.*left/i.test(elText(el)))
    );
  }

  function startOTPTimer(timerEl) {
    if (otpTimerActive) return;
    otpTimerActive = true;
    let remaining = 21;
    setElText(timerEl, `Resend OTP in: ${remaining} secs`);
    if (timerEl.tagName === 'BUTTON' || timerEl.tagName === 'INPUT') {
      // eslint-disable-next-line no-param-reassign
      timerEl.disabled = true;
    }
    otpTimerInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(otpTimerInterval);
        otpTimerActive = false;
        setElText(timerEl, 'Resend OTP');
        if (timerEl.tagName === 'BUTTON' || timerEl.tagName === 'INPUT') {
          // eslint-disable-next-line no-param-reassign
          timerEl.disabled = false;
        }
      } else {
        setElText(timerEl, `Resend OTP in: ${remaining} secs`);
      }
    }, 1000);
  }

  function populateOTPPage() {
    const data = getJourneyData();
    if (!data.mockOTP) {
      data.mockOTP = Math.floor(100000 + Math.random() * 900000).toString();
      data.otpAttemptsLeft = '3';
      sessionStorage.setItem('loanJourneyData', JSON.stringify(data));
    }
    // eslint-disable-next-line no-console
    console.info(`[Journey] Test OTP: ${data.mockOTP}`);

    const otpEl = document.querySelector('input[name="otp_code"]');
    const timerEl = findTimerEl();
    const attemptsEl = findAttemptsEl();

    if (otpEl && !otpEl.value) otpEl.value = data.mockOTP;
    if (timerEl && !otpTimerActive) startOTPTimer(timerEl);
    if (attemptsEl) {
      const cur = attemptsEl.value || attemptsEl.textContent || '';
      if (!cur.includes('attempt')) {
        setElText(attemptsEl, `${data.otpAttemptsLeft || 3}/3 attempt(s) left`);
      }
    }
    return !!(otpEl && otpEl.value);
  }

  let retries = 0;
  const poll = setInterval(() => {
    retries += 1;
    if (populateOTPPage() || retries >= 20) clearInterval(poll);
  }, 300);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    const timerTarget = e.target.closest('[name="resend_otp_timer"]');

    if ((btn && btn.name === 'resend_otp_timer') || timerTarget) {
      if (otpTimerActive) return;
      e.preventDefault();
      const data = getJourneyData();
      data.mockOTP = Math.floor(100000 + Math.random() * 900000).toString();
      data.otpAttemptsLeft = '3';
      sessionStorage.setItem('loanJourneyData', JSON.stringify(data));
      const otpEl = document.querySelector('input[name="otp_code"]');
      if (otpEl) otpEl.value = data.mockOTP;
      const timerEl = findTimerEl();
      const attemptsEl = findAttemptsEl();
      if (attemptsEl) setElText(attemptsEl, '3/3 attempt(s) left');
      clearInterval(otpTimerInterval);
      otpTimerActive = false;
      if (timerEl) startOTPTimer(timerEl);
      return;
    }

    if (!btn) return;
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
      const attemptsEl = findAttemptsEl();
      if (attemptsEl) setElText(attemptsEl, `${left}/3 attempt(s) left`);
      const errEl = document.querySelector('input[name="otp_error"]');
      if (errEl) {
        errEl.value = left === 0
          ? 'No attempts left. Please resend OTP.'
          : 'Invalid OTP. Please try again.';
      }
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
  if (!window.location.pathname.includes('personal-loan-offer')) return;

  // eslint-disable-next-line no-console
  console.info('[Journey] Offer page handler active');

  function calcEMI(P, n) {
    if (!P || !n) return 0;
    const r = 10.20 / (12 * 100);
    const powered = (1 + r) ** n;
    return Math.round((P * r * powered) / (powered - 1));
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
    const P = parseFloat(getVal('loan_amount')) || 1000000;
    const n = parseInt(getVal('tenure_months'), 10) || 36;
    // eslint-disable-next-line no-console
    console.info(`[Journey] EMI calc: P=${P} n=${n}`);
    setVal('emi_display', String(calcEMI(P, n)));
    setVal('rate_of_interest', '10.20');
    setVal('taxes', String(Math.round(P * 0.02 * 0.18)));
  }

  // AEM Forms resets fields during its own init — wait for it to finish
  setTimeout(updateOfferDisplay, 2000);
  setTimeout(updateOfferDisplay, 4000);

  document.addEventListener('input', (e) => {
    if (e.target.closest('[name="loan_amount"]') || e.target.closest('[name="tenure_months"]')) {
      updateOfferDisplay();
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.closest('[name="loan_amount"]') || e.target.closest('[name="tenure_months"]')) {
      updateOfferDisplay();
    }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (!btn.textContent.trim().toLowerCase().includes('proceed')) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const P = parseFloat(getVal('loan_amount')) || 1000000;
    const n = parseInt(getVal('tenure_months'), 10) || 36;

    const data = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
    data.selectedLoanAmount = P;
    data.selectedTenure = n;
    data.selectedEMI = calcEMI(P, n);
    data.selectedRate = 10.20;
    sessionStorage.setItem('loanJourneyData', JSON.stringify(data));

    window.location.href = getEDSUrl('/personal-loan-preview');
  }, true);
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
  initLoanJourneyHandlers();
  initOTPPageHandlers();
  initOfferPageHandlers();
}

loadPage();
