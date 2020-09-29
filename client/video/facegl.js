/* global perf, extracted */

const draw = require('./draw.js');

async function glDraw({ points, offsetX, offsetY, width, height }) {
  const t0 = performance.now();
  const canvas = new OffscreenCanvas(width, height);

  const gl = canvas.getContext('webgl');
  const vertices = [];
  const max = { z: Math.max(...points.map((a) => a[2])) };
  for (const pt of points) {
    vertices.push(2.0 * (pt[0] - offsetX) / canvas.width - 1.0);
    vertices.push(-2.0 * (pt[1] - offsetY) / canvas.height + 1.0);
    vertices.push(1.0 * pt[2] / max.z);
  }

  const vertex_buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  const vertCode = 'attribute vec3 coordinates; void main(void) {gl_Position = vec4(coordinates, 1.0); gl_PointSize = 2.0;}';
  const vertShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertShader, vertCode);
  gl.compileShader(vertShader);
  const fragCode = 'void main(void) {gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);}';
  const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragShader, fragCode);
  gl.compileShader(fragShader);
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertShader);
  gl.attachShader(shaderProgram, fragShader);
  gl.linkProgram(shaderProgram);
  gl.useProgram(shaderProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
  const coord = gl.getAttribLocation(shaderProgram, 'coordinates');
  gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(coord);
  gl.clearColor(0.5, 0.5, 0.5, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.drawArrays(gl.POINTS, 0, Math.trunc(vertices.length / 3));

  const t1 = performance.now();
  perf.GL = Math.trunc(t1 - t0);
  extracted.push(draw.crop(canvas, 0, 0, canvas.width, canvas.height, { title: 'facemesh' }));
}

exports.draw = glDraw;
