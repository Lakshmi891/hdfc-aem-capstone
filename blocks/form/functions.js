/**
 * Get Full Name
 * @name getFullName Concats first name and last name
 * @param {string} firstname in Stringformat
 * @param {string} lastname in Stringformat
 * @return {string}
 */
function getFullName(firstname, lastname) {
  return `${firstname} ${lastname}`.trim();
}

/**
 * Custom submit function
 * @param {scope} globals
 */
function submitFormArrayToString(globals) {
  const data = globals.functions.exportData();
  Object.keys(data).forEach((key) => {
    if (Array.isArray(data[key])) {
      data[key] = data[key].join(',');
    }
  });
  globals.functions.submitForm(data, true, 'application/json');
}

/**
 * Calculate the number of days between two dates.
 * @param {*} endDate
 * @param {*} startDate
 * @returns {number} returns the number of days between two dates
 */
function days(endDate, startDate) {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const diffInMs = Math.abs(end.getTime() - start.getTime());
  return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
}

/**
 * Masks the first 5 digits of the mobile number with *
 * @param {*} mobileNumber
 * @returns {string} returns the mobile number with first 5 digits masked
 */
function maskMobileNumber(mobileNumber) {
  if (!mobileNumber) {
    return '';
  }
  const value = mobileNumber.toString();
  return `${'*'.repeat(5)}${value.substring(5)}`;
}

// ─── Loan Journey Utilities ───────────────────────────────────────────────────

/**
 * Validates a 10-digit Indian mobile number
 * @name validateMobile
 * @param {string} mobile
 * @return {boolean}
 */
function validateMobile(mobile) {
  return /^[6-9]\d{9}$/.test((mobile || '').toString().trim());
}

/**
 * Validates PAN card format (e.g. ATIPA5141K)
 * @name validatePAN
 * @param {string} pan
 * @return {boolean}
 */
function validatePAN(pan) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test((pan || '').toString().trim().toUpperCase());
}

/**
 * Computes EMI using the standard formula
 * EMI = P x r x (1+r)^n / ((1+r)^n - 1)
 * @name computeEMI
 * @param {number} principal Loan amount in INR
 * @param {number} annualRate Annual interest rate (e.g. 10.20)
 * @param {number} tenureMonths Loan tenure in months
 * @return {number} Monthly EMI rounded to nearest rupee
 */
function computeEMI(principal, annualRate, tenureMonths) {
  const P = parseFloat(principal) || 0;
  const rate = parseFloat(annualRate) || 0;
  const n = parseInt(tenureMonths, 10) || 0;
  if (!P || !rate || !n) return 0;
  const r = rate / (12 * 100);
  const powered = Math.pow(1 + r, n);
  return Math.round((P * r * powered) / (powered - 1));
}

/**
 * Reads a value from the loan journey session state
 * @name getJourneyField
 * @param {string} fieldKey
 * @return {string}
 */
function getJourneyField(fieldKey) {
  try {
    const data = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
    return data[fieldKey] || '';
  } catch (e) {
    return '';
  }
}

/**
 * Saves a value to the loan journey session state (no PII logged)
 * @name saveJourneyField
 * @param {string} fieldKey
 * @param {string} fieldValue
 * @return {string} empty string (side-effect only)
 */
function saveJourneyField(fieldKey, fieldValue) {
  try {
    const data = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
    data[fieldKey] = fieldValue;
    sessionStorage.setItem('loanJourneyData', JSON.stringify(data));
  } catch (e) {
    console.error('[Journey] Failed to save state');
  }
  return '';
}

// ─── OTP Functions ────────────────────────────────────────────────────────────

/**
 * Generates a fresh random 6-digit OTP and stores it in session.
 * Called internally — not directly from rule editor.
 * @return {string} The generated OTP
 */
function generateOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  saveJourneyField('mockOTP', otp);
  return otp;
}

/**
 * Returns the stored OTP so the rule editor can set it as the OTP field's value.
 * @name getStoredOTP
 * @return {string}
 */
function getStoredOTP() {
  return getJourneyField('mockOTP') || '';
}

/**
 * Returns the masked mobile number to display on the OTP page.
 * e.g. *****94837
 * @name getMaskedMobileForDisplay
 * @return {string}
 */
function getMaskedMobileForDisplay() {
  const mobile = getJourneyField('mobileNo');
  if (!mobile) return '';
  return `${'*'.repeat(5)}${mobile.toString().substring(5)}`;
}

/**
 * Navigates back to the welcome/login page so the user can edit their mobile number.
 * Wire to the "Edit mobile number" button click in the rule editor.
 * @name navigateToWelcomePage
 * @return {string}
 */
function navigateToWelcomePage() {
  window.location.href = '/personal-loan-welcome';
  return '';
}

/**
 * Sets the text/value of a DOM element found by its field name.
 * Works for both input fields and button elements.
 */
function setFieldText(fieldName, text, disabled) {
  const el = document.querySelector(
    `input[name="${fieldName}"], button[name="${fieldName}"], textarea[name="${fieldName}"]`,
  );
  if (!el) return;
  if (el.tagName === 'BUTTON') {
    el.textContent = text;
    el.disabled = disabled;
  } else {
    el.value = text;
  }
}

/**
 * Starts the 21-second resend countdown on the resend_otp_timer button.
 * The button is disabled while counting and re-enabled when it hits 0.
 *
 * @name startResendTimer
 * @param {string} timerFieldName  name attribute of the resend_otp_timer button/field
 * @return {string}
 */
function startResendTimer(timerFieldName) {
  if (globalThis.otpTimerInterval) {
    clearInterval(globalThis.otpTimerInterval);
  }

  let remaining = 21;
  setFieldText(timerFieldName, `Resend OTP in: ${remaining} secs`, true);

  globalThis.otpTimerInterval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(globalThis.otpTimerInterval);
      setFieldText(timerFieldName, 'Resend OTP', false);
    } else {
      setFieldText(timerFieldName, `Resend OTP in: ${remaining} secs`, true);
    }
  }, 1000);

  return '';
}

/**
 * Initializes the OTP page on form load:
 *   - Generates a fresh random OTP
 *   - Starts the 21-second resend timer on resend_otp_timer
 *   - Initialises the attempts display on attempts_left
 *   - Returns the OTP so the rule editor sets it into otp_input
 *
 * Rule editor wiring (on the otp_confirmation_panel or form root):
 *   WHEN is initialized
 *   THEN SET VALUE OF otp_input = initOTPPage("resend_otp_timer", "attempts_left")
 *
 * @name initOTPPage
 * @param {string} timerFieldName   name of the resend_otp_timer field
 * @param {string} attemptsFieldName name of the attempts_left field
 * @return {string} The generated OTP (auto-fills otp_input)
 */
function initOTPPage(timerFieldName, attemptsFieldName) {
  const otp = generateOTP();
  saveJourneyField('otpAttemptsLeft', '3');
  setTimeout(() => {
    startResendTimer(timerFieldName);
    setFieldText(attemptsFieldName, '3/3 attempt(s) left', false);
  }, 300);
  return otp;
}

/**
 * Resends a new OTP when the resend_otp_timer button is clicked.
 * Generates a fresh OTP, restarts the 21-second timer,
 * resets the attempts counter, and returns the new OTP to fill otp_input.
 *
 * Rule editor wiring (on resend_otp_timer button):
 *   WHEN clicked
 *   THEN SET VALUE OF otp_input = resendOTP("resend_otp_timer", "attempts_left")
 *
 * @name resendOTP
 * @param {string} timerFieldName
 * @param {string} attemptsFieldName
 * @return {string} The new OTP
 */
function resendOTP(timerFieldName, attemptsFieldName) {
  const newOtp = generateOTP();
  saveJourneyField('otpAttemptsLeft', '3');
  startResendTimer(timerFieldName);
  setFieldText(attemptsFieldName, '3/3 attempt(s) left', false);
  return newOtp;
}

// ─── Journey Navigation Functions ─────────────────────────────────────────────

/**
 * Initiates customer identification and navigates to OTP page on success.
 * Generates a random OTP (not fixed) and stores mobile number in session.
 * @name initiateCustomerOTP
 * @param {string} mobileNo
 * @param {string} identifierName PAN_NO or DOB
 * @param {string} identifierValue
 * @param {scope} globals
 * @return {string} 'success' or an error message
 */
function initiateCustomerOTP(mobileNo, identifierName, identifierValue, _globals) {
  const journeyId = `PJ_${Date.now()}`;
  try {
    if (!validateMobile(mobileNo)) {
      return 'Please enter a valid 10-digit mobile number.';
    }
    if (identifierName === 'PAN_NO' && !validatePAN(identifierValue)) {
      return 'Please enter a valid PAN (e.g. ABCDE1234F).';
    }
    saveJourneyField('partnerJourneyID', journeyId);
    saveJourneyField('bankJourneyID', `BJ_${Date.now()}`);
    saveJourneyField('identifierName', identifierName);
    saveJourneyField('mobileNo', mobileNo);
    generateOTP();
    window.location.href = '/personal-loan-otp';
    return 'success';
  } catch (e) {
    return 'Something went wrong. Please try again.';
  }
}

/**
 * Verifies OTP against the stored session OTP (random, not hardcoded).
 * Loads offer data on success and navigates to offer page.
 * @name verifyCustomerOTP
 * @param {string} otp The 6-digit OTP entered by the user
 * @param {scope} globals
 * @return {string} 'success' or an error message
 */
function verifyCustomerOTP(otp, attemptsFieldName, _globals) {
  const journeyId = getJourneyField('partnerJourneyID');
  try {
    const storedOTP = getJourneyField('mockOTP');
    if ((otp || '').toString().trim() !== storedOTP) {
      const left = Math.max(0, parseInt(getJourneyField('otpAttemptsLeft') || '3', 10) - 1);
      saveJourneyField('otpAttemptsLeft', left.toString());
      setFieldText(attemptsFieldName, `${left}/3 attempt(s) left`, false);
      console.info(`[Journey: ${journeyId}] OTP verification failed`);
      return left === 0 ? 'No attempts left. Please resend OTP.' : 'Invalid OTP. Please try again.';
    }

    const offer = {
      customerFirstName: 'Ankit',
      customerLastName: 'Enterprises',
      customerAddress1: '1301, Barkha',
      customerCity: 'Mumbai',
      customerState: 'Maharashtra',
      zipCode: '400016',
      offerAmount: '1000000.00',
      tenure: '36',
      rateOfInterest: '10.20',
      kycFlag: 'Y',
      accountNumber: 'XX50151',
      customerID: 'XX12345',
    };

    const data = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
    data.offerDemogDetails = offer;
    data.customerName = `${offer.customerFirstName} ${offer.customerLastName}`;
    sessionStorage.setItem('loanJourneyData', JSON.stringify(data));

    console.info(`[Journey: ${journeyId}] OTP verified, offer loaded`);
    window.location.href = '/personal-loan-offer';
    return 'success';
  } catch (e) {
    console.error(`[Journey: ${journeyId}] VerifyOTP error:`, e.message);
    return 'Something went wrong. Please try again.';
  }
}

/**
 * Saves selected loan amount and tenure, computes EMI, then navigates to preview.
 * @name proceedToPreview
 * @param {number} loanAmount
 * @param {number} tenureMonths
 * @param {scope} globals
 * @return {string}
 */
function proceedToPreview(loanAmount, tenureMonths, _globals) {
  try {
    const data = JSON.parse(sessionStorage.getItem('loanJourneyData') || '{}');
    const offer = data.offerDemogDetails || {};
    const rate = parseFloat(offer.rateOfInterest) || 10.20;
    const emi = computeEMI(loanAmount, rate, tenureMonths);

    data.selectedLoanAmount = loanAmount;
    data.selectedTenure = tenureMonths;
    data.selectedEMI = emi;
    data.selectedRate = rate;
    sessionStorage.setItem('loanJourneyData', JSON.stringify(data));

    console.info(`[Journey: ${data.partnerJourneyID || ''}] Proceeding to preview`);

    window.location.href = '/personal-loan-preview';
    return 'success';
  } catch (e) {
    console.error('[Journey] proceedToPreview error:', e.message);
    return 'Unable to proceed. Please try again.';
  }
}

/**
 * Submits the final loan application and navigates to thank-you page on success.
 * @name submitLoanApp
 * @param {scope} globals
 * @return {string}
 */
function submitLoanApp(_globals) {
  const journeyId = getJourneyField('partnerJourneyID');
  try {
    const ackId = `14${Math.floor(Math.random() * 9000000 + 1000000)}`;
    saveJourneyField('acknowledgementId', ackId);

    console.info(`[Journey: ${journeyId}] Loan application submitted`);
    window.location.href = '/personal-loan-thankyou';
    return 'success';
  } catch (e) {
    console.error(`[Journey: ${journeyId}] Submit error:`, e.message);
    return 'Submission failed. Please try again.';
  }
}

// eslint-disable-next-line import/prefer-default-export
export {
  getFullName,
  days,
  submitFormArrayToString,
  maskMobileNumber,
  validateMobile,
  validatePAN,
  computeEMI,
  getJourneyField,
  saveJourneyField,
  getStoredOTP,
  getMaskedMobileForDisplay,
  navigateToWelcomePage,
  setFieldText,
  startResendTimer,
  initOTPPage,
  resendOTP,
  initiateCustomerOTP,
  verifyCustomerOTP,
  proceedToPreview,
  submitLoanApp,
};
