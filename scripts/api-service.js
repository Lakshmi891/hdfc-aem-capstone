import { setJourneyData } from './journey-state.js';

const CONTEXT = {
  partnerId: 'HDFCBANK',
  channelID: 'ADOBE',
  productName: 'PL',
  partnerJourneyID: `PJ_${Date.now()}`,
};

const FILLER_FIELDS = {
  filler1: '',
  filler2: '',
  filler3: '',
  filler4: '',
  filler5: '',
  filler6: '',
  filler7: '',
  filler8: '',
  filler9: '',
  filler10: '',
};

function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/**
 * API 1: InitiateCustomerIdentification
 * Request matches PDF spec: contextParam + requestString with msgType and fillerFields.
 */
export async function initiateCustomerIdentification(mobileNo, identifierName, identifierValue) {
  await delay(500);
  const journeyId = CONTEXT.partnerJourneyID;

  if (!mobileNo || mobileNo.length !== 10) {
    return { status: { responseCode: '1', errorCode: 'INVALID_MOBILE', errorDesc: 'Invalid mobile number' } };
  }

  const bankJourneyID = `BJ_${Date.now()}`;
  const response = {
    contextParam: {
      partnerID: CONTEXT.partnerId,
      channelID: CONTEXT.channelID,
      productName: CONTEXT.productName,
      partnerJourneyID: journeyId,
      bankJourneyID,
    },
    responseString: { offerAvailable: 'Y', existingCustomer: 'Y' },
    status: { responseCode: '0', errorCode: '', errorDesc: '' },
  };

  setJourneyData({
    mobileNo,
    identifierName,
    identifierValue,
    bankJourneyID,
    partnerJourneyID: journeyId,
  });

  // eslint-disable-next-line no-console
  console.info(`[Journey: ${journeyId}] InitiateCustomerIdentification success`);
  return response;
}

/**
 * API 2: VerifyOTPAndGetDemogDetails
 * OTP field name in the request is passwordValue (per PDF spec), not otp.
 * Happy path in mock: any valid 6-digit value succeeds.
 */
export async function verifyOTPAndGetDemogDetails(passwordValue) {
  await delay(500);
  const journeyId = CONTEXT.partnerJourneyID;

  if (!passwordValue || passwordValue.toString().length !== 6) {
    // eslint-disable-next-line no-console
    console.info(`[Journey: ${journeyId}] OTP verification failed`);
    return {
      status: { responseCode: '1', errorCode: 'OTP_INVALID', errorDesc: 'Please enter a valid 6-digit OTP.' },
    };
  }

  const offer = {
    customerFirstName: 'Ankit',
    customerMiddleName: '',
    customerLastName: 'Enterprises',
    customerAddress1: '1301, Barkha',
    customerAddress2: 'Opposite Brigh School, Village Road',
    customerAddress3: '',
    customerState: 'Maharashtra',
    customerCity: 'Mumbai',
    zipCode: '400016',
    customerCountry: 'India',
    customerGender: 'M',
    dateOfBirth: '01-01-1900',
    emailAddress: 'ankit@gmail.com',
    customerMobileNo: '98709212345',
    monthlyIncome: '',
    profession: '',
    residenceType: '',
    offerType: 'LG_HNW_BL_PQ_NB_FEB22',
    offerAmount: '1000000.00',
    tenure: '36',
    rateOfInterest: '10.20',
    kycFlag: 'Y',
    custType: '',
    reltype: '',
    accountNumber: 'XX50151',
    customerID: 'XX12345',
  };

  setJourneyData({
    offerDemogDetails: offer,
    customerName: `${offer.customerFirstName} ${offer.customerLastName}`,
  });

  // eslint-disable-next-line no-console
  console.info(`[Journey: ${journeyId}] OTP verified — offer data stored (no PII logged)`);
  return {
    contextParam: {
      partnerID: CONTEXT.partnerId,
      channelID: CONTEXT.channelID,
      productName: CONTEXT.productName,
      partnerJourneyID: journeyId,
    },
    responseString: { OfferDemogDetails: [offer] },
    status: { responseCode: '0', errorCode: '', errorDesc: '' },
  };
}

/**
 * API 3: Submit Loan Application
 * Request fields match the PDF spec (loanAmount, tenure, rateofInterest, emi, etc.).
 */
export async function submitLoanApplication(loanData = {}) {
  await delay(800);
  const journeyId = CONTEXT.partnerJourneyID;

  const request = {
    contextParam: {
      partnerID: CONTEXT.partnerId,
      channelID: CONTEXT.channelID,
      productName: CONTEXT.productName,
      partnerJourneyID: journeyId,
      bankJourneyID: loanData.bankJourneyID || '',
    },
    requestString: {
      loanAmount: loanData.loanAmount || '',
      tenure: loanData.tenure || '',
      rateofInterest: loanData.rateOfInterest || '',
      emi: loanData.emi || '',
      processingfees: loanData.processingFees || '',
      product: loanData.product || '',
      consentTocALL: loanData.consentToCAll || '',
      educationalQualification: loanData.educationalQualification || '',
      monthlyTakeHomeSalary: loanData.monthlyTakeHomeSalary || '',
      noOfDependent: loanData.noOfDependent || '',
      salesPromotion: loanData.salesPromotion || '',
      yearAtCity: loanData.yearAtCity || '',
      yearAtCurrentAddress: loanData.yearAtCurrentAddress || '',
      employerName: loanData.employerName || '',
      vkycConsent: loanData.vkycConsent || '',
      vkycRetUrl: loanData.vkycRetUrl || '',
      leadRetUrl: loanData.leadRetUrl || '',
      flgDropOff: loanData.flgDropOff || '',
      fillerFields: { ...FILLER_FIELDS },
    },
  };

  const acknowledgementId = `14${Math.floor(Math.random() * 9000000 + 1000000)}`;
  const response = {
    contextParam: { ...request.contextParam },
    responseString: { vkycLink: '', acknowledgementId },
    status: { responseCode: '0', errorCode: '', errorDesc: '' },
  };

  setJourneyData({ acknowledgementId });
  // eslint-disable-next-line no-console
  console.info(`[Journey: ${journeyId}] Loan application submitted`);
  return response;
}
