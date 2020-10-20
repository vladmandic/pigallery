const gestures = [];
const find = {};

find.body = (res) => {
  const pose = (res.body && res.body[0]) ? res.body[0] : null;
  if (!pose) return;

  const leftWrist = pose.keypoints.find((a) => (a.part === 'leftWrist'));
  const rightWrist = pose.keypoints.find((a) => (a.part === 'rightWrist'));
  const nose = pose.keypoints.find((a) => (a.part === 'nose'));
  if (nose && leftWrist && rightWrist && (leftWrist.position.y < nose.position.y) && (rightWrist.position.y < nose.position.y)) gestures.push('i give up');
  else if (nose && (leftWrist || rightWrist) && ((leftWrist?.position.y < nose.position.y) || (rightWrist?.position.y < nose.position.y))) gestures.push('raise hand');

  const leftShoulder = pose.keypoints.find((a) => (a.part === 'leftShoulder'));
  const rightShoulder = pose.keypoints.find((a) => (a.part === 'rightShoulder'));
  if (leftShoulder && rightShoulder) gestures.push(`leaning ${(leftShoulder.position.y > rightShoulder.position.y) ? 'left' : 'right'}`);
};

find.face = (res) => {
  const face = (res.face && res.face[0]) ? res.face[0] : null;
  if (!face) return;
  if (face.annotations['rightCheek'] && face.annotations['leftCheek'] && (face.annotations['rightCheek'].length > 0) && (face.annotations['leftCheek'].length > 0)) {
    gestures.push(`facing ${((face.annotations['rightCheek'][0][2] > 0) || (face.annotations['leftCheek'][0][2] < 0)) ? 'right' : 'left'}`);
  }
};

find.hand = (res) => {
  const hand = (res.hand && res.hand[0]) ? res.hand[0] : null;
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
  gestures.length = 0;
  if (res && res[0] && res[0].piface) {
    find.face(res[0].piface);
    find.body(res[0].piface);
    find.hand(res[0].piface);
  }
  return gestures;
}

exports.analyze = analyze;
