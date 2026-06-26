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
      window.location.href = '/personal-loan-otp';
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Journey] Failed to initiate:', err);
    }
  });
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
  initLoanJourneyHandlers();
}

loadPage();
