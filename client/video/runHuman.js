import Human from '@vladmandic/human/dist/human.esm-nobundle.js';
import * as draw from './draw.js';

const human = new Human();
let canvas;
let ctx;

function drawFace(result, ui) {
  for (const face of result) {
    const labels = [];
    if (face.agConfidence) labels.push(`${Math.trunc(100 * face.agConfidence)}% ${face.gender || ''}`);
    if (face.age) labels.push(`age: ${face.age || ''}`);
    if (face.iris) labels.push(`iris: ${face.iris}`);
    if (face.emotion && face.emotion[0]) labels.push(`${Math.trunc(100 * face.emotion[0].score)}% ${face.emotion[0].emotion}`);
    if (ui.drawBoxes) {
      draw.rect({
        canvas,
        x: face.box[0],
        y: face.box[1],
        width: face.box[2],
        height: face.box[3],
        lineWidth: ui.lineWidth,
        color: ui.lineColor,
        title: labels,
      });
    }
    // silly hack since fillText does not suport new line
    ctx.lineWidth = 1;
    if (face.mesh) {
      if (ui.drawPoints) {
        for (const point of face.mesh) {
          draw.point({
            canvas,
            x: point[0],
            y: point[1],
            color: ui.useDepth ? `rgba(${127.5 + (2 * point[2])}, ${127.5 - (2 * point[2])}, 255, 0.5)` : ui.lineColor,
            radius: 2,
          });
        }
      }
      for (let i = 0; i < human.facemesh.triangulation.length / 3; i++) {
        const points = [
          human.facemesh.triangulation[i * 3 + 0],
          human.facemesh.triangulation[i * 3 + 1],
          human.facemesh.triangulation[i * 3 + 2],
        ].map((index) => face.mesh[index]);
        const path = new Path2D();
        path.moveTo(points[0][0], points[0][1]);
        for (const point of points) {
          path.lineTo(point[0], point[1]);
        }
        path.closePath();
        if (ui.drawPolygons) {
          ctx.strokeStyle = ui.useDepth ? `rgba(${127.5 + (2 * points[0][2])}, ${127.5 - (2 * points[0][2])}, 255, 0.3)` : ui.lineColor;
          ctx.stroke(path);
        }
        if (ui.fillPolygons) {
          ctx.fillStyle = ui.useDepth ? `rgba(${127.5 + (2 * points[0][2])}, ${127.5 - (2 * points[0][2])}, 255, 0.3)` : ui.lineColor;
          ctx.fill(path);
        }
      }
    }
  }
}

function drawBody(result, ui) {
  for (const pose of result) {
    if (ui.drawPoints) {
      for (const point of pose.keypoints) {
        draw.point({
          canvas,
          x: point.position.x,
          y: point.position.y,
          color: ui.lineColor,
          radius: 2,
        });
      }
    }
    ctx.strokeStyle = ui.lineColor;
    ctx.lineWidth = ui.lineWidth;
    if (ui.drawPolygons) {
      const path = new Path2D();
      let part;
      // torso
      part = pose.keypoints.find((a) => a.part === 'leftShoulder');
      path.moveTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'rightShoulder');
      path.lineTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'rightHip');
      path.lineTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'leftHip');
      path.lineTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'leftShoulder');
      path.lineTo(part.position.x, part.position.y);
      // legs left
      part = pose.keypoints.find((a) => a.part === 'leftHip');
      path.moveTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'leftKnee');
      path.lineTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'leftAnkle');
      path.lineTo(part.position.x, part.position.y);
      // legs right
      part = pose.keypoints.find((a) => a.part === 'rightHip');
      path.moveTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'rightKnee');
      path.lineTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'rightAnkle');
      path.lineTo(part.position.x, part.position.y);
      // arms left
      part = pose.keypoints.find((a) => a.part === 'leftShoulder');
      path.moveTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'leftElbow');
      path.lineTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'leftWrist');
      path.lineTo(part.position.x, part.position.y);
      // arms right
      part = pose.keypoints.find((a) => a.part === 'rightShoulder');
      path.moveTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'rightElbow');
      path.lineTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'rightWrist');
      path.lineTo(part.position.x, part.position.y);
      // draw all
      ctx.stroke(path);
    }
  }
}

function drawHand(result, ui) {
  for (const hand of result) {
    ctx.font = ui.font;
    ctx.lineWidth = ui.lineWidth;
    if (ui.drawBoxes) {
      draw.rect({
        canvas,
        x: hand.box[0],
        y: hand.box[1],
        width: hand.box[2],
        height: hand.box[3],
        lineWidth: ui.lineWidth,
        color: ui.lineColor,
        title: 'hand',
      });
    }
    if (ui.drawPoints) {
      for (const point of hand.landmarks) {
        draw.point({
          canvas,
          x: point[0],
          y: point[1],
          color: ui.useDepth ? `rgba(${127.5 + (2 * point[2])}, ${127.5 - (2 * point[2])}, 255, 0.5)` : ui.lineColor,
          radius: 2,
        });
      }
    }
    if (ui.drawPolygons) {
      const addPart = (part) => {
        for (let i = 1; i < part.length; i++) {
          ctx.lineWidth = ui.lineWidth;
          ctx.beginPath();
          ctx.strokeStyle = ui.useDepth ? `rgba(${127.5 + (2 * part[i][2])}, ${127.5 - (2 * part[i][2])}, 255, 0.5)` : ui.lineColor;
          ctx.moveTo(part[i - 1][0], part[i - 1][1]);
          ctx.lineTo(part[i][0], part[i][1]);
          ctx.stroke();
        }
      };
      addPart(hand.annotations.indexFinger);
      addPart(hand.annotations.middleFinger);
      addPart(hand.annotations.ringFinger);
      addPart(hand.annotations.pinky);
      addPart(hand.annotations.thumb);
      addPart(hand.annotations.palmBase);
    }
  }
}

function appendCanvas(name, width, height, objects) {
  objects.canvases[name] = document.createElement('canvas');
  objects.canvases[name].style.position = 'relative';
  objects.canvases[name].id = `canvas-${name}`;
  objects.canvases[name].className = 'canvases';
  objects.canvases[name].width = width;
  objects.canvases[name].height = height;
  objects.canvases[name].style.zIndex = Object.keys(objects.canvases).length;
  document.getElementById('canvases').appendChild(objects.canvases[name]);
}

async function run(input, config, objects) {
  const t0 = performance.now();
  const result = await human.detect(input, config.human);
  const t1 = performance.now();
  objects.perf.Human = Math.trunc(t1 - t0);
  // draw image from video
  // const ctx = canvas.getContext('2d');
  // if (result.canvas) ctx.drawImage(result.canvas, 0, 0, result.canvas.width, result.canvas.height, 0, 0, canvas.width, canvas.height);
  // else ctx.drawImage(input, 0, 0, input.width, input.height, 0, 0, canvas.width, canvas.height);
  // draw all results
  if (!objects.canvases.human) appendCanvas('human', input.width, input.height, objects);
  canvas = objects.canvases.human;
  ctx = canvas.getContext('2d');
  if (result.canvas) ctx.drawImage(result.canvas, 0, 0, result.canvas.width, result.canvas.height, 0, 0, objects.canvases.human.width, objects.canvases.human.height);
  else ctx.drawImage(input, 0, 0, input.width, input.height, 0, 0, objects.canvases.human.width, objects.canvases.human.height);

  if (result.face) drawFace(result.face, config.ui);
  if (result.body) drawBody(result.body, config.ui);
  if (result.hand) drawHand(result.hand, config.ui);

  for (const face of result.face) {
    let label = 'Human: ';
    if (face.agConfidence) label += `${Math.trunc(100 * face.agConfidence)}% ${face.gender || ''} `;
    if (face.age) label += `age: ${face.age || ''} `;
    if (face.iris) label += `iris: ${face.iris} `;
    if (face.emotion && face.emotion[0]) label += `${Math.trunc(100 * face.emotion[0].score)}% ${face.emotion[0].emotion} `;
    label += ']';
    objects.detected.push(label);
  }
  return { human: result };
}

async function load(config) {
  await human.load(config.human);
}

exports.run = run;
exports.load = load;
