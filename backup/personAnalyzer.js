/* global faceapi */

async function log(msg) {
  const div = document.getElementById('log');
  div.innerHTML += `${msg}<br>`;
}

async function loadImage(imageUrl) {
  return new Promise((resolve) => {
    const image = document.createElement('img');
    image.width = 800;
    image.src = imageUrl;
    image.addEventListener('load', resolve(image));
    // image.onload(() => resolve(image));
  });
  /*
  const res = await fetch(imageUrl);
  if (res.status < 400) {
    try {
      const blob = await res.blob();
      return await faceapi.bufferToImage(blob);
    } catch (err) {
      log(`Image convert error:${imageUrl} ${err}`);
    }
  } else {
    log(`Image fetch error:${imageUrl} code:${res.status}`);
  }
  return null;
  */
}

async function processPerson(image) {
  // const inputImgEl = $('#inputImg').get(0);
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
  const result = await faceapi.detectSingleFace(image, options)
    .withFaceLandmarks()
    .withFaceExpressions()
    .withAgeAndGender();
  if (result) {
    let emotion = Object.entries(result.expressions)
      .reduce(([keyPrev, valPrev], [keyCur, valCur]) => (valPrev > valCur ? [keyPrev, valPrev] : [keyCur, valCur]));
    emotion = { label: emotion && emotion[0] ? emotion[0] : '', confidence: emotion && emotion[1] ? emotion[1] : 0 };
    log(`Results: ${(100 * result.genderProbability).toFixed(2)}% ${result.gender} age ${result.age.toFixed(1)}y emotion ${(100 * emotion.confidence).toFixed(2)}% ${emotion.label}`);
  }
}

async function main() {
  log('Loading model: SSD-MobileNet-v1');
  await faceapi.nets.ssdMobilenetv1.load('models/faceapi/');
  await faceapi.loadFaceLandmarkModel('models/faceapi/');
  await faceapi.nets.ageGenderNet.load('models/faceapi/');
  await faceapi.loadFaceExpressionModel('models/faceapi/');
  log('Loading image');
  log('Ready...');
  const image = await loadImage('samples/sample%20(53).jpg');
  processPerson(image);
  image.remove();
}

main();
