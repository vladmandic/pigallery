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
  const dt = new Date();
  const ts = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}:${dt.getSeconds().toString().padStart(2, '0')}.${dt.getMilliseconds().toString().padStart(3, '0')}`;
  if (typeof msg[0] === 'number') {
    const t0 = msg[0];
    const t1 = performance.now();
    const duration = t1 - t0;
    if (duration && (typeof duration === 'number')) msg[0] = duration > 10 ? `${Math.round(t1 - t0).toLocaleString()} ms:` : null;
  }
  if (msg[0] === null) msg.shift();
  // eslint-disable-next-line no-console
  console.log(ts, ...msg);
  return ts;
}

async function server(...msg) {
  debug(...msg);
  fetch(`/api/log/put?msg=${encodeURIComponent(str(...msg))}`);
}

async function div(id, append, ...msg) {
  const elem = document.getElementById(id);
  const ts = await debug(...msg);
  if (elem) {
    const html = `<span class="timestamp">${ts}</span> ${str(...msg).replace(/  /g, ' &nbsp ')}`;
    if (append) elem.innerHTML += html + '<br>';
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
