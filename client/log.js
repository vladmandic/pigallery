let dots = 0;

async function dot() {
  const div = document.getElementById('log');
  if (div) div.innerHTML += '.';
  dots = dots < 100 ? dots + 1 : 0;
  if (dots > 100) div.innerHTML += '<br>';
}

async function result(...msg) {
  let msgs = '';
  msgs += msg.map((a) => a);
  const div = document.getElementById('log');
  if (div) div.innerHTML += `${msgs.replace(' ', '&nbsp')}<br>`;
  if (div) div.scrollTop = div.scrollHeight;
  if (msgs.length > 0) fetch(`/api/log?msg=${msgs}`); // .then((res) => res.text());
  // eslint-disable-next-line no-console
  console.log(...msg);
}

async function active(...msg) {
  const div = document.getElementById('active');
  if (div) div.innerHTML = `${msg}<br>`;
  // eslint-disable-next-line no-console
  else console.log(...msg);
}

const log = {
  result,
  active,
  dot,
};

export default log;
