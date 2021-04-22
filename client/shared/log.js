function str(...msg) {
  if (!Array.isArray(msg)) return msg;
  let line = '';
  for (const entry of msg) {
    if (typeof entry === 'object') line += JSON.stringify(entry).replace(/{|}|"|\[|\]/g, '').replace(/,/g, ', ');
    else line += entry;
  }
  return line;
}

async function debug(...msg) {
  // const ts = `${moment().format('HH:mm:ss.SS')}:`;
  const threshold = 100;
  const dt = new Date();
  const ts = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}:${dt.getSeconds().toString().padStart(2, '0')}.${dt.getMilliseconds().toString().padStart(3, '0')}`;
  let time;
  if (typeof msg[0] === 'number') {
    const t0 = msg[0];
    const t1 = performance.now();
    const duration = t1 - t0;
    if (duration && (typeof duration === 'number')) time = duration >= threshold ? Math.round(t1 - t0) : null;
    msg.shift();
  }
  // eslint-disable-next-line no-console
  if (time) console.log(ts, '[', time, 'ms ]', ...msg);
  // eslint-disable-next-line no-console
  else console.log(ts, ...msg);
  return ts;
}

async function server(...msg) {
  debug(...msg);
  fetch(`/api/log/put?msg=${encodeURIComponent(str(...msg))}`)
    .then((res) => res)
    .catch((err) => debug('api log:', err));
}

async function div(id, append, ...msg) {
  const elem = document.getElementById(id);
  const ts = await debug(...msg);
  if (elem) {
    // eslint-disable-next-line no-regex-spaces
    const html = `<span class="timestamp">${ts}</span> ${str(...msg).replace(/  /g, ' &nbsp ')}`;
    if (append) elem.innerHTML += `${html}<br>`;
    else elem.innerHTML = html;
    elem.scrollTop = elem.scrollHeight;
    elem.scrollIntoView(false);
  }
}

module.exports = {
  debug,
  div,
  server,
  str,
};
