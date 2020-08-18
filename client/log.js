const moment = require('moment');

let dots = 0;
let divDot;
async function dot(line) {
  if (!divDot) divDot = document.getElementById('log');
  if (divDot) divDot.innerHTML += '.';
  dots = dots < 100 ? dots + 1 : 0;
  if ((dots >= 100) || line) divDot.innerHTML += '<br>';
}

let divResult;
async function result(...msg) {
  if (!divResult) divResult = document.getElementById('log');
  let msgs = '';
  msgs += msg.map((a) => a);
  if (divResult) divResult.innerHTML += `<span class="timestamp">${moment().format('HH:mm:ss')}</span> ${msgs.replace(' ', '&nbsp')}<br>`;
  if (divResult) divResult.scrollTop = divResult.scrollHeight;
  if (msgs.length > 2) fetch(`/api/log?msg=${msgs}`);
  const ts = moment().format('HH:mm:ss.SS') + ':';
  // eslint-disable-next-line no-console
  console.log(ts, ...msg);
}

async function debug(t0, ...msg) {
  if (!window.debug) return;
  const ts = moment().format('HH:mm:ss.SS') + ':';
  const t1 = window.performance.now();
  const duration = t0 !== null ? t1 - t0 : 0;
  const d = duration > 50 ? `in ${Math.round(t1 - t0).toLocaleString()} ms` : '';
  // eslint-disable-next-line no-console
  console.log(ts, ...msg, d);
}

let divActive;
async function active(...msg) {
  if (!divActive) divActive = document.getElementById('active');
  if (divActive) divActive.innerHTML = `${msg}<br>`;
  // eslint-disable-next-line no-console
  else console.log(...msg);
}

let divState;
async function state(msg, append = true) {
  if (!divState) divState = document.getElementById('state') || document.getElementById('log');
  if (divState) {
    if (!append) divState.innerHTML = `${msg}`;
    else divState.innerHTML += `&nbsp${msg}<br>`;
  }
  // eslint-disable-next-line no-console
  console.log(msg);
}

module.exports = {
  result,
  debug,
  active,
  state,
  dot,
};
