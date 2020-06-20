const db = require('./indexdb.js');
const log = require('./log.js');

onmessage = (msg) => {
  console.log('Worker', msg);
  postMessage('worker done');
};
