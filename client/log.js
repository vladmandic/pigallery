const moment = require('moment');

let dots = 0;
let divDot;
async function dot() {
  if (!divDot) divDot = document.getElementById('log');
  if (divDot) divDot.innerHTML += '.';
  dots = dots < 100 ? dots + 1 : 0;
  if (dots >= 100) divDot.innerHTML += '<br>';
}

let divResult;
async function result(...msg) {
  if (!divResult) divResult = document.getElementById('log');
  let msgs = '';
  msgs += msg.map((a) => a);
  if (divResult) divResult.innerHTML += `<span class="timestamp">${moment().format('HH:mm:ss')}</span> ${msgs.replace(' ', '&nbsp')}<br>`;
  if (divResult) divResult.scrollTop = divResult.scrollHeight;
  if (msgs.length > 2) fetch(`/api/log?msg=${msgs}`);
  // eslint-disable-next-line no-console
  console.log(...msg);
}

async function debug(t0, ...msg) {
  if (!window.debug) return;
  let msgs = '';
  msgs += msg.map((a) => a);
  if (t0) {
    const t1 = window.performance.now();
    const duration = t1 - t0;
    if (duration > 50) msgs += ` in ${Math.round(duration).toLocaleString()} ms`;
  }
  // eslint-disable-next-line no-console
  console.log(msgs);
}

let divActive;
async function active(...msg) {
  if (!divActive) divActive = document.getElementById('active');
  if (divActive) divActive.innerHTML = `${msg}<br>`;
  // eslint-disable-next-line no-console
  else console.log(...msg);
}

let divState;
async function state(msg, append) {
  if (!divState) divState = document.getElementById('state');
  if (divState) {
    if (!append) divState.innerHTML = `${msg}`;
    else divState.innerHTML += `&nbsp${msg}`;
  // eslint-disable-next-line no-console
  } else console.log(...msg);
}

module.exports = {
  result,
  debug,
  active,
  state,
  dot,
};
