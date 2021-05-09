import { tf } from '../shared/tf';
import * as log from '../shared/log';
import * as modelClassify from '../process/modelClassify';

// eslint-disable-next-line import/prefer-default-export
export async function run(name, input, config, objects) {
  const t0 = performance.now();
  if (!objects.models[name]) {
    (document.getElementById('status') as HTMLElement).innerText = `loading model: ${name} ...`;
    const memory0 = await tf.memory();
    const modelOptions = config.models.classify.find((a) => a.name === name) || config.models.various.find((a) => a.name === name);
    objects.models[name] = await modelClassify.load(modelOptions);
    const memory1 = await tf.memory();
    (document.getElementById('status') as HTMLElement).innerText = '';
    log.div('log', true, `loaded model ${name}: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!objects.models[name]) {
    log.div('log', true, `model ${name} not loaded`);
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
