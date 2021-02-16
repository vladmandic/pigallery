import { tf } from '../shared/tf.js';
import * as log from '../shared/log.js';
import * as modelClassify from '../process/modelClassify.js';

export async function run(name, input, config, objects) {
  const t0 = performance.now();
  if (!objects.models[name]) {
    // @ts-ignore
    document.getElementById('status').innerText = `loading model: ${name} ...`;
    const memory0 = await tf.memory();
    const options = config.models.classify.find((a) => a.name === name) || config.models.various.find((a) => a.name === name);
    objects.models[name] = await modelClassify.load(options);
    const memory1 = await tf.memory();
    // @ts-ignore
    document.getElementById('status').innerText = '';
    log.div('log', true, `Loaded model ${name}: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!objects.models[name]) {
    log.div('log', true, `Model ${name} not loaded`);
    return null;
  }
  const res = await modelClassify.classify(objects.models[name], input);
  if (res) {
    if (!objects.classified[name]) objects.classified[name] = [];
    for (const item of res) objects.classified[name].push(`${(100 * item.score).toFixed(1)}% ${item.class}`);
  }
  const t1 = performance.now();
  objects.perf[name] = Math.trunc(t1 - t0);
  return { name: res };
}
