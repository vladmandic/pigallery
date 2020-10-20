import Human from '@vladmandic/human';

const human = new Human();

async function run(input, config, objects) {
  const t0 = performance.now();
  const res = await human.detect(input, config);
  const t1 = performance.now();
  objects.perf.Human = Math.trunc(t1 - t0);
  return res;
}

exports.run = run;
