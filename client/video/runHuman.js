import Human from '@vladmandic/human/dist/human.esm-nobundle';
import * as draw from './draw';

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
    ctx.lineJoin = 'round';
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
      part = pose.keypoints.find((a) => a.part === 'rightShoulder');
      path.moveTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'leftShoulder');
      path.lineTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'leftElbow');
      path.lineTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'leftWrist');
      path.lineTo(part.position.x, part.position.y);
      // arms right
      part = pose.keypoints.find((a) => a.part === 'leftShoulder');
      path.moveTo(part.position.x, part.position.y);
      part = pose.keypoints.find((a) => a.part === 'rightShoulder');
      path.lineTo(part.position.x, part.position.y);
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
    ctx.lineJoin = 'round';
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
      // eslint-disable-next-line no-loop-func
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

export async function run(input, config, objects) {
  // const t0 = performance.now();
  const result = await human.detect(input, config.human);
  // const t1 = performance.now();
  // objects.perf.Human = Math.trunc(t1 - t0);

  // draw all results
  if (!objects.canvases.human) draw.appendCanvas('human', input.width, input.height, objects);
  // recreate canvas if resolution changed
  if (objects.canvases.human.width !== input.width) {
    draw.clear(objects.canvases.human);
    document.getElementById('canvases').removeChild(objects.canvases.human);
    objects.canvases.human = null;
    draw.appendCanvas('human', input.width, input.height, objects);
  }
  canvas = objects.canvases.human;
  ctx = canvas.getContext('2d');

  draw.clear(canvas);
  // draw image from video if processed by human, else ignore
  if (result.canvas) ctx.drawImage(result.canvas, 0, 0, result.canvas.width, result.canvas.height, 0, 0, objects.canvases.human.width, objects.canvases.human.height);
  // else ctx.drawImage(input, 0, 0, input.width, input.height, 0, 0, objects.canvases.human.width, objects.canvases.human.height);

  if (result.face) drawFace(result.face, config.ui);
  if (result.body) drawBody(result.body, config.ui);
  if (result.hand) drawHand(result.hand, config.ui);
  for (const face of result.face) {
    let label = '';
    if (face.agConfidence) label += `${Math.trunc(100 * face.agConfidence)}% ${face.gender || ''} `;
    if (face.age) label += `age: ${face.age || ''} `;
    if (face.emotion && face.emotion[0]) label += `${Math.trunc(100 * face.emotion[0].score)}% ${face.emotion[0].emotion} `;
    if (face.iris) label += `distance: ${face.iris} `;
    label += ']';
    objects.human.push(label);
  }
  let label = 'gesture:';
  for (const gesture of result.gesture) {
    label += ` ${Object.keys(gesture)[0]} ${Object.values(gesture)[1]}`;
  }
  if (label !== 'gesture:') objects.human.push(label);
  return { human: result };
}

export async function load(config) {
  await human.load(config.human);
}
