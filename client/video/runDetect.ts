import { tf } from '../shared/tf';
import * as log from '../shared/log';
import * as draw from './draw';
import * as modelDetect from '../process/modelDetect';

// eslint-disable-next-line import/prefer-default-export
export async function run(name, input, config, objects) {
  const t0 = performance.now();
  if (!objects.models[name]) {
    (document.getElementById('status') as HTMLElement).innerText = `loading model: ${name} ...`;
    const memory0 = await tf.memory();
    const modelOptions = config.models.detect.find((a) => a.name === name);
    objects.models[name] = await modelDetect.load(modelOptions);
    const memory1 = await tf.memory();
    (document.getElementById('status') as HTMLElement).innerText = '';
    log.div('log', true, `Loaded model ${name}: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!objects.models[name]) {
    log.div('log', true, `Model ${name} not loaded`);
    return null;
  }
  if (!objects.canvases[name]) draw.appendCanvas(name, input.width, input.height, objects);
  const canvas = objects.canvases[name];

  const res = await modelDetect.detect(objects.models[name], input);
  draw.clear(canvas);
  if (res) {
    if (!objects.detected[name]) objects.detected[name] = [];
    for (const item of res) {
      objects.detected[name].push(`${(100 * item.score).toFixed(1)}% ${item.class}`);
      if (config.ui.drawBoxes && item.box) {
        draw.rect({
          canvas,
          x: item.box.x,
          y: item.box.y,
          width: item.box.width,
          height: item.box.height,
          lineWidth: config.ui.lineWidth,
          color: config.ui.lineColor,
          title: item.class,
        });
      }
    }
  }

  const t1 = performance.now();
  objects.perf[name] = Math.trunc(t1 - t0);
  return { name: res };
}
