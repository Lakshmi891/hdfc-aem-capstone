import { setJourneyData } from './journey-state.js';

const CONTEXT = {
  partnerId: 'HDFCBANK',
  channelID: 'ADOBE',
  productName: 'PL',
  partnerJourneyID: `PJ_${Date.now()}`,
};

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function initiateCustomerIdentification(mobileNo, identifierName, identifierValue) {
  await delay(500);
  const journeyId = CONTEXT.partnerJourneyID;

  if (!mobileNo || mobileNo.length !== 10) {
    return { status: { responseCode: '1', errorCode: 'INVALID_MOBILE', errorDesc: 'Invalid mobile number' } };
  }

  const response = {
    contextParam: { ...CONTEXT, bankJourneyID: `BJ_${Date.now()}` },
    responseString: { offerAvailable: 'Y', existingCustomer: 'Y' },
    status: { responseCode: '0', errorCode: '', errorDesc: '' },
  };

  setJourneyData({
    mobileNo,
    identifierName,
    identifierValue,
    bankJourneyID: response.contextParam.bankJourneyID,
    partnerJourneyID: journeyId,
  });

  console.info(`[Journey: ${journeyId}] InitiateCustomerIdentification success`);
  return response;
}

export async function verifyOTPAndGetDemogDetails(otp) {
  await delay(500);
  const journeyId = CONTEXT.partnerJourneyID;

  if (otp !== '123456') {
    console.info(`[Journey: ${journeyId}] OTP verification failed`);
    return {
      status: { responseCode: '1', errorCode: 'OTP_INVALID', errorDesc: 'Invalid OTP. Please try again.' },
    };
  }

  const offer = {
    customerFirstName: 'Ankit',
    customerMiddleName: '',
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

  setJourneyData({
    offerDemogDetails: offer,
    customerName: `${offer.customerFirstName} ${offer.customerLastName}`,
  });

  console.info(`[Journey: ${journeyId}] OTP verified — offer data stored (no PII logged)`);
  return {
    contextParam: { ...CONTEXT },
    responseString: { OfferDemogDetails: [offer] },
    status: { responseCode: '0', errorCode: '', errorDesc: '' },
  };
}

export async function submitLoanApplication(loanData) {
  await delay(800);
  const journeyId = CONTEXT.partnerJourneyID;

  const response = {
    contextParam: { ...CONTEXT },
    responseString: {
      vkycLink: '',
      acknowledgementId: `14${Math.floor(Math.random() * 9000000 + 1000000)}`,
    },
    status: { responseCode: '0', errorCode: '', errorDesc: '' },
  };

  setJourneyData({ acknowledgementId: response.responseString.acknowledgementId });
  console.info(`[Journey: ${journeyId}] Loan application submitted`);
  return response;
}
