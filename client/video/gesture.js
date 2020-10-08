/* global params */

const gestures = [];
const find = {};

find.body = (res) => {
  const posenet = res.find((a) => a.posenet);
  const pose = (posenet && posenet.posenet && posenet.posenet[0]) ? posenet.posenet[0] : null;
  if (!pose) return;

  const leftWrist = pose.keypoints.find((a) => (a.score > params.minThreshold) && (a.part === 'leftWrist'));
  const rightWrist = pose.keypoints.find((a) => (a.score > params.minThreshold) && (a.part === 'rightWrist'));
  const nose = pose.keypoints.find((a) => (a.score > params.minThreshold) && (a.part === 'nose'));
  if (nose && leftWrist && rightWrist && (leftWrist.position.y < nose.position.y) && (rightWrist.position.y < nose.position.y)) gestures.push('i give up');
  else if (nose && (leftWrist || rightWrist) && ((leftWrist?.position.y < nose.position.y) || (rightWrist?.position.y < nose.position.y))) gestures.push('raise hand');

  const leftShoulder = pose.keypoints.find((a) => (a.score > params.minThreshold) && (a.part === 'leftShoulder'));
  const rightShoulder = pose.keypoints.find((a) => (a.score > params.minThreshold) && (a.part === 'rightShoulder'));
  if (leftShoulder && rightShoulder) gestures.push(`leaning ${(leftShoulder.position.y > rightShoulder.position.y) ? 'left' : 'right'}`);
};

find.face = (res) => {
  const piface = res.find((a) => a.piface);
  const face = (piface && piface.piface && piface.piface[0]) ? piface.piface[0] : null;
  if (!face) return;
  if ((face.annotations['rightCheek'].length > 0) || (face.annotations['rightCheek'].length > 0)) {
    gestures.push(`facing ${((face.annotations['rightCheek'][0][2] > 0) || (face.annotations['leftCheek'][0][2] < 0)) ? 'right' : 'left'}`);
  }
};

find.hand = (res) => {
  const handpose = res.find((a) => a.handpose);
  const hand = (handpose && handpose.handpose && handpose.handpose[0]) ? handpose.handpose[0] : null;
  if (!hand) return;
  const fingers = [];
  for (const [finger, pos] of Object.entries(hand['annotations'])) {
    if (finger !== 'palmBase') fingers.push({ name: finger.toLowerCase(), position: pos[0] }); // get tip of each finger
  }
  const closest = fingers.reduce((best, a) => (best.position[2] < a.position[2] ? best : a));
  const highest = fingers.reduce((best, a) => (best.position[1] < a.position[1] ? best : a));
  gestures.push(`${closest.name} forward ${highest.name} up`);
};

async function analyze(res) {
  const t0 = performance.now();
  gestures.length = 0;
  find.face(res);
  find.body(res);
  find.hand(res);
  const t1 = performance.now();
  window.perf.Gestures = Math.trunc(t1 - t0);
  return gestures;
}

exports.analyze = analyze;
