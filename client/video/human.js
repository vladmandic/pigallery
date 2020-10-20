import Human from '@vladmandic/human';

const human = new Human();

async function run(input, config) {
  const res = human.detect(input, config);
  console.log('human', human.version, res);
  return res;
}

exports.run = run;
