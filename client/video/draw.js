const defaultFont = 'small-caps 1rem "Segoe UI"';
const extractSize = 100;

function rect({ canvas = null, x = 0, y = 0, width = 0, height = 0, radius = 8, lineWidth = 2, color = 'white', title = null, font = null }) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = color;
  ctx.font = font || defaultFont;
  if (title) ctx.fillText(title, x + lineWidth, y + lineWidth + 16);
}

function point({ canvas = null, x = 0, y = 0, color = 'white', radius = 2, title = null, font = null }) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = font || defaultFont;
  if (title) ctx.fillText(title, x + 10, y + 4);
}

function connect({ points = [], canvas = null, lineWidth = 2, color = 'white', title = null, font = null }) {
  if (!canvas) return;
  if (points.length < 2) return;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const pt of points) ctx.lineTo(pt[0], pt[1]);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.font = font || defaultFont;
  if (title) ctx.fillText(title, points[0][0] + 4, points[0][1] + 16);
}

function curve({ points = [], canvas = null, lineWidth = 2, color = 'white', title = null, font = null }) {
  if (!canvas) return;
  if (points.length < 2) return;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < points.length - 1; i++) {
    const x_mid = (points[i][0] + points[i + 1][0]) / 2;
    const y_mid = (points[i][1] + points[i + 1][1]) / 2;
    const cp_x1 = (x_mid + points[i][0]) / 2;
    const cp_x2 = (x_mid + points[i + 1][0]) / 2;
    ctx.quadraticCurveTo(cp_x1, points[i][1], x_mid, y_mid);
    ctx.quadraticCurveTo(cp_x2, points[i + 1][1], points[i + 1][0], points[i + 1][1]);
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.font = font || defaultFont;
  if (title) ctx.fillText(title, points[0][0] + 4, points[0][1] + 16);
}

function crop(image, x, y, width, height, { color = 'white', title = null, font = null }) {
  const canvas = document.createElement('canvas', { desynchronized: true });
  canvas.width = extractSize * width / height;
  canvas.height = extractSize;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = font || defaultFont;
  if (title) ctx.fillText(title, 2, 16, canvas.width - 4);
  return canvas;
}

function spline({ points = [], canvas = null, tension = 0.5, lineWidth = 2, color = 'white', title = null, font = null }) {
  if (!canvas) return;
  if (points.length < 2) return;
  const va = (arr, i, j) => [arr[2 * j] - arr[2 * i], arr[2 * j + 1] - arr[2 * i + 1]];
  const distance = (arr, i, j) => Math.sqrt(((arr[2 * i] - arr[2 * j]) ** 2) + ((arr[2 * i + 1] - arr[2 * j + 1]) ** 2));
  // eslint-disable-next-line no-unused-vars
  function ctlpts(x1, y1, x2, y2, x3, y3) {
    // eslint-disable-next-line prefer-rest-params
    const v = va(arguments, 0, 2);
    // eslint-disable-next-line prefer-rest-params
    const d01 = distance(arguments, 0, 1);
    // eslint-disable-next-line prefer-rest-params
    const d12 = distance(arguments, 1, 2);
    const d012 = d01 + d12;
    return [
      x2 - v[0] * tension * d01 / d012, y2 - v[1] * tension * d01 / d012,
      x2 + v[0] * tension * d12 / d012, y2 + v[1] * tension * d12 / d012,
    ];
  }
  const pts = [];
  for (const pt of points) {
    pts.push(pt[0]);
    pts.push(pt[1]);
  }
  let cps = [];
  for (let i = 0; i < pts.length - 2; i += 1) {
    cps = cps.concat(ctlpts(pts[2 * i + 0], pts[2 * i + 1], pts[2 * i + 2], pts[2 * i + 3], pts[2 * i + 4], pts[2 * i + 5]));
  }
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  if (points.length === 2) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    ctx.lineTo(pts[2], pts[3]);
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    // first segment is a quadratic
    ctx.quadraticCurveTo(cps[0], cps[1], pts[2], pts[3]);
    // for all middle points, connect with bezier
    let i;
    for (i = 2; i < ((pts.length / 2) - 1); i += 1) {
      ctx.bezierCurveTo(cps[(2 * (i - 1) - 1) * 2], cps[(2 * (i - 1) - 1) * 2 + 1], cps[(2 * (i - 1)) * 2], cps[(2 * (i - 1)) * 2 + 1], pts[i * 2], pts[i * 2 + 1]);
    }
    // last segment is a quadratic
    ctx.quadraticCurveTo(cps[(2 * (i - 1) - 1) * 2], cps[(2 * (i - 1) - 1) * 2 + 1], pts[i * 2], pts[i * 2 + 1]);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.font = font || defaultFont;
  if (title) ctx.fillText(title, points[0][0] + 4, points[0][1] + 16);
}

function bezier({ points = [], canvas = null, tension = 0.5, lineWidth = 2, color = 'white', title = null, font = null }) {
  // tension at 0 will be straight line; factor is normally 1, but changing the value can control the smoothness too
  const factor = 1;
  if (!canvas) return;
  if (points.length < 2) return;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  let dx1 = 0;
  let dy1 = 0;
  let preP = points[0];
  for (let i = 1; i < points.length; i++) {
    const curP = points[i];
    const nexP = points[i + 1];
    const m = nexP ? (nexP[1] - preP[1]) / (nexP[0] - preP[0]) : 0;
    const dx2 = nexP ? (nexP[0] - curP[0]) * -factor : 0;
    const dy2 = nexP ? dx2 * m * tension : 0;
    ctx.bezierCurveTo(preP[0] - dx1, preP[1] - dy1, curP[0] + dx2, curP[1] + dy2, curP[0], curP[1]);
    dx1 = dx2;
    dy1 = dy2;
    preP = curP;
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.font = font || defaultFont;
  if (title) ctx.fillText(title, points[0][0] + 4, points[0][1] + 16);
}

function clear(canvas) {
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

exports.connect = connect;
exports.rect = rect;
exports.point = point;
exports.crop = crop;
exports.clear = clear;
exports.curve = curve;
exports.spline = spline;
exports.bezier = bezier;
