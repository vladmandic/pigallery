const tf = require('@tensorflow/tfjs');

async function main() {
  console.log('starting bundler load');
  await tf.ready();
  console.log(`tf ready ${tf.version.tfjs}`);
}
main();

exports.tf = tf;
