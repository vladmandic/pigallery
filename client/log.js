const div = {};

async function dot() {
  div.Log.innerHTML += '.';
}

async function result(...msg) {
  let msgs = '';
  msgs += msg.map((a) => a);
  if (div && div.Log) div.Log.innerHTML += `${msgs.replace(' ', '&nbsp')}<br>`;
  div.Log.scrollTop = div.Log.scrollHeight;
  if (msgs.length > 0) fetch(`/log?msg=${msgs}`).then((res) => res.text());
  // eslint-disable-next-line no-console
  console.log(...msg);
}

async function active(...msg) {
  if (div && div.Active) div.Active.innerHTML = `${msg}<br>`;
  // eslint-disable-next-line no-console
  else console.log(...msg);
}

function init() {
  div.Log = document.getElementById('log');
  div.Active = document.getElementById('active');
}

const log = {
  result,
  active,
  init,
  dot,
};

export default log;
