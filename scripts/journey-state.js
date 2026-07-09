const KEY = 'loanJourneyData';

export function getJourneyData() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function setJourneyData(updates) {
  const current = getJourneyData();
  sessionStorage.setItem(KEY, JSON.stringify({ ...current, ...updates }));
}

export function clearJourney() {
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem('offerDemogDetails');
  sessionStorage.removeItem('submissionResult');
}

export function getField(key) {
  return getJourneyData()[key];
}
