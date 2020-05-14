import * as tf from '@tensorflow/tfjs';

const div = {};

async function result(...msg) {
  if (div && div.Log) div.Log.innerHTML += `${msg}<br>`;
  // eslint-disable-next-line no-console
  console.log(...msg);
}

async function active(...msg) {
  const mem = await tf.memory();
  if (div && div.Active) div.Active.innerHTML = `${msg}<br>Memory State: Bytes:${mem.numBytes.toLocaleString()} Buffers:${mem.numDataBuffers.toLocaleString()} Tensors:${mem.numTensors.toLocaleString()}`;
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
};

export default log;
