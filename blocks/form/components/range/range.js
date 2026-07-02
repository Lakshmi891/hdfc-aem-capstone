function formatIndianUnits(n) {
  const v = parseFloat(n);
  if (v >= 100000) {
    const l = v / 100000;
    return `${Number.isInteger(l) ? l : l.toFixed(1)}L`;
  }
  if (v >= 1000) {
    const k = v / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return `${v}`;
}

function formatIndianComma(n) {
  const v = Math.round(parseFloat(n));
  const s = String(v);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

const BUBBLE_FORMATTERS = {
  'field-loan-amount': (v) => `₹${formatIndianComma(v)}`,
  'field-tenure-months': (v) => `${v} months`,
};

const TICK_FORMATTERS = {
  'field-loan-amount': (v) => formatIndianUnits(v),
  'field-tenure-months': (v) => `${v}m`,
};

const TICK_VALUES = {
  'field-loan-amount': [50000, 200000, 400000, 600000, 800000, 1000000, 1500000],
  'field-tenure-months': [12, 24, 36, 48, 60, 72, 84],
};

function getBubbleFormatter(fieldDiv) {
  const entry = Object.entries(BUBBLE_FORMATTERS).find(([cls]) => fieldDiv.classList.contains(cls));
  return entry ? entry[1] : (v) => `${v}`;
}

function getTickFormatter(fieldDiv) {
  const entry = Object.entries(TICK_FORMATTERS).find(([cls]) => fieldDiv.classList.contains(cls));
  return entry ? entry[1] : (v) => `${v}`;
}

function getTickValues(fieldDiv) {
  const entry = Object.entries(TICK_VALUES).find(([cls]) => fieldDiv.classList.contains(cls));
  return entry ? entry[1] : null;
}

function updateBubble(input, element, fmt) {
  const step = input.step || 1;
  const max = input.max || 0;
  const min = input.min || 1;
  const value = input.value || 1;
  const current = Math.ceil((value - min) / step);
  const total = Math.ceil((max - min) / step);
  const bubble = element.querySelector('.range-bubble');
  // during initial render the width is 0. Hence using a default here.
  const bubbleWidth = bubble.getBoundingClientRect().width || 31;
  const left = `${(current / total) * 100}% - ${(current / total) * bubbleWidth}px`;
  bubble.innerText = fmt(value);
  const steps = {
    '--total-steps': Math.ceil((max - min) / step),
    '--current-steps': Math.ceil((value - min) / step),
  };
  const style = Object.entries(steps).map(([k, v]) => `${k}:${v}`).join(';');
  bubble.style.left = `calc(${left})`;
  element.setAttribute('style', style);
}
export default async function decorate(fieldDiv, fieldJson) {
  const input = fieldDiv.querySelector('input');
  // modify the type in case it is not range.
  input.type = 'range';
  input.min = input.min || 1;
  input.max = input.max || 100;
  input.step = fieldJson?.properties?.stepValue || 1;
  // create a wrapper div to provide the min/max and current value
  const div = document.createElement('div');
  div.className = 'range-widget-wrapper decorated';
  input.after(div);
  const hover = document.createElement('span');
  hover.className = 'range-bubble';
  const rangeMinEl = document.createElement('span');
  rangeMinEl.className = 'range-min';
  const rangeMaxEl = document.createElement('span');
  rangeMaxEl.className = 'range-max';

  const bubbleFmt = getBubbleFormatter(fieldDiv);
  const tickFmt = getTickFormatter(fieldDiv);
  const ticks = getTickValues(fieldDiv);

  if (ticks) {
    rangeMinEl.hidden = true;
    rangeMaxEl.hidden = true;
  } else {
    rangeMinEl.innerText = `${input.min || 1}`;
    rangeMaxEl.innerText = `${input.max}`;
  }

  div.appendChild(hover);
  // move the input element within the wrapper div
  div.appendChild(input);
  div.appendChild(rangeMinEl);
  div.appendChild(rangeMaxEl);

  if (ticks) {
    const minVal = parseFloat(input.min) || 0;
    const maxVal = parseFloat(input.max) || 100;
    const ticksEl = document.createElement('div');
    ticksEl.className = 'range-ticks';
    ticks.forEach((val) => {
      const tick = document.createElement('span');
      tick.className = 'range-tick';
      tick.textContent = tickFmt(val);
      const pct = ((val - minVal) / (maxVal - minVal)).toFixed(4);
      // 25px = thumb width; offset aligns label with thumb center at that value
      tick.style.left = `calc(${pct} * (100% - 25px) + 12.5px)`;
      ticksEl.appendChild(tick);
    });
    div.appendChild(ticksEl);
  }

  input.addEventListener('input', (e) => {
    updateBubble(e.target, div, bubbleFmt);
  });
  updateBubble(input, div, bubbleFmt);
  return fieldDiv;
}
