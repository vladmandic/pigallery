/* eslint-disable no-use-before-define */
/* eslint-disable no-underscore-dangle */
import * as tf from '@tensorflow/tfjs';

export const v1_tiny_model = 'https://raw.githubusercontent.com/shaqian/tfjs-yolo-demo/master/dist/model/v1tiny/model.json';
export const v2_tiny_model = 'https://raw.githubusercontent.com/shaqian/tfjs-yolo-demo/master/dist/model/v2tiny/model.json';
export const v3_tiny_model = 'https://raw.githubusercontent.com/shaqian/tfjs-yolo-demo/master/dist/model/v3tiny/model.json';
export const v3_model = 'https://raw.githubusercontent.com/shaqian/tfjs-yolo-demo/master/dist/model/v3/model.json';

const v1_tiny_anchors = [1.08, 1.19, 3.42, 4.41, 6.63, 11.38, 9.42, 5.11, 16.62, 10.52];
const v2_tiny_anchors = [0.57273, 0.677385, 1.87446, 2.06253, 3.33843, 5.47434, 7.88282, 3.52778, 9.77052, 9.16828];
const v3_anchors = [10, 13, 16, 30, 33, 23, 30, 61, 62, 45, 59, 119, 116, 90, 156, 198, 373, 326];
const v3_tiny_anchors = [10, 14, 23, 27, 37, 58, 81, 82, 135, 169, 344, 319];
const v3_masks = { 3: [[6, 7, 8], [3, 4, 5], [0, 1, 2]], 2: [[3, 4, 5], [1, 2, 3]] };

const MAX_BOXES = 20;
const INPUT_SIZE = 416;
const SCORE_THRESHOLD = 0.5;
const IOU_THRESHOLD = 0.3;

async function _loadModel(pathOrIOHandler, modelUrl) {
  if (modelUrl) return tf.loadGraphModel(modelUrl, pathOrIOHandler);
  return tf.loadLayersModel(pathOrIOHandler);
}

async function postprocess(version, outputs, anchors, numClasses, classNames, imageShape, maxBoxes, scoreThreshold, iouThreshold) {
  const isV3 = version.indexOf('v3') > -1;
  const [boxes, boxScores] = yoloEval(isV3, outputs, anchors, numClasses, imageShape);
  const boxes_ = [];
  const scores_ = [];
  let classes_ = [];
  const _classes = tf.argMax(boxScores, -1);
  const _boxScores = tf.max(boxScores, -1);
  const nmsIndex = await tf.image.nonMaxSuppressionAsync(boxes, _boxScores, maxBoxes, iouThreshold, scoreThreshold);

  if (nmsIndex.size) {
    tf.tidy(() => {
      const classBoxes = tf.gather(boxes, nmsIndex);
      const classBoxScores = tf.gather(_boxScores, nmsIndex);
      classBoxes.split(nmsIndex.size).map((box) => boxes_.push(box.dataSync()));
      classBoxScores.dataSync().map((score) => scores_.push(score));
      classes_ = _classes.gather(nmsIndex).dataSync();
    });
  }
  _boxScores.dispose();
  _classes.dispose();
  nmsIndex.dispose();
  boxes.dispose();
  boxScores.dispose();
  // tf.dispose(splitBoxScores);
  return boxes_.map((box, i) => {
    const top = Math.max(0, box[0]);
    const left = Math.max(0, box[1]);
    const bottom = Math.min(imageShape[0], box[2]);
    const right = Math.min(imageShape[1], box[3]);
    const height = bottom - top;
    const width = right - left;
    return { top, left, bottom, right, height, width, score: scores_[i], class: classNames[classes_[i]] };
  });
}

function yoloEval(isV3, outputs, anchors, numClasses, imageShape) {
  return tf.tidy(() => {
    let numLayers = 1;
    let inputShape;
    let anchorMask;
    if (isV3) {
      numLayers = outputs.length;
      anchorMask = v3_masks[numLayers];
      inputShape = outputs[0].shape.slice(1, 3).map((num) => num * 32);
    } else {
      inputShape = outputs.shape.slice(1, 3);
    }
    const anchorsTensor = tf.tensor1d(anchors).reshape([-1, 2]);
    let boxes = [];
    let boxScores = [];
    for (let i = 0; i < numLayers; i++) {
      const [_boxes, _boxScores] = yoloBoxesAndScores(
        isV3,
        isV3 ? outputs[i] : outputs,
        isV3 ? anchorsTensor.gather(tf.tensor1d(anchorMask[i], 'int32')) : anchorsTensor,
        numClasses,
        inputShape,
        imageShape,
      );
      boxes.push(_boxes);
      boxScores.push(_boxScores);
    }
    boxes = tf.concat(boxes);
    boxScores = tf.concat(boxScores);
    return [boxes, boxScores];
  });
}

function yoloBoxesAndScores(isV3, feats, anchors, numClasses, inputShape, imageShape) {
  const [boxXy, boxWh, boxConfidence, boxClassProbs] = yoloHead(isV3, feats, anchors, numClasses, inputShape);
  let boxes = yoloCorrectBoxes(boxXy, boxWh, imageShape);
  boxes = boxes.reshape([-1, 4]);
  let boxScores = tf.mul(boxConfidence, boxClassProbs);
  boxScores = tf.reshape(boxScores, [-1, numClasses]);
  return [boxes, boxScores];
}

function yoloHead(isV3, feats, anchors, numClasses, inputShape) {
  const numAnchors = anchors.shape[0];
  const anchorsTensor = tf.reshape(anchors, [1, 1, numAnchors, 2]);
  const gridShape = feats.shape.slice(1, 3); // height, width
  const gridY = tf.tile(tf.reshape(tf.range(0, gridShape[0]), [-1, 1, 1, 1]), [1, gridShape[1], 1, 1]);
  const gridX = tf.tile(tf.reshape(tf.range(0, gridShape[1]), [1, -1, 1, 1]), [gridShape[0], 1, 1, 1]);
  const grid = tf.concat([gridX, gridY], 3).cast(feats.dtype);
  const reshaped = feats.reshape([gridShape[0], gridShape[1], numAnchors, numClasses + 5]);
  const [xy, wh, con, probs] = tf.split(reshaped, [2, 2, 1, numClasses], 3);
  const boxXy = tf.div(tf.add(tf.sigmoid(xy), grid), gridShape.reverse());
  const boxWh = tf.div(tf.mul(tf.exp(wh), anchorsTensor), inputShape.reverse());
  const boxConfidence = tf.sigmoid(con);
  let boxClassProbs;
  if (isV3) {
    boxClassProbs = tf.sigmoid(probs);
  } else {
    boxClassProbs = tf.softmax(probs);
  }
  return [boxXy, boxWh, boxConfidence, boxClassProbs];
}

function yoloCorrectBoxes(boxXy, boxWh, imageShape) {
  const boxYx = tf.concat(tf.split(boxXy, 2, 3).reverse(), 3);
  const boxHw = tf.concat(tf.split(boxWh, 2, 3).reverse(), 3);
  const boxMins = tf.mul(tf.sub(boxYx, tf.div(boxHw, 2)), imageShape);
  const boxMaxes = tf.mul(tf.add(boxYx, tf.div(boxHw, 2)), imageShape);
  const boxes = tf.concat([
    ...tf.split(boxMins, 2, 3),
    ...tf.split(boxMaxes, 2, 3),
  ], 3);
  return boxes;
}

async function _predict(
  version,
  model,
  image,
  maxBoxes,
  scoreThreshold,
  iouThreshold,
  numClasses,
  anchors,
  classNames,
  inputSize,
) {
  const outputs = tf.tidy(() => {
    const canvas = document.createElement('canvas');
    canvas.width = inputSize;
    canvas.height = inputSize;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, inputSize, inputSize);
    let imageTensor = tf.browser.fromPixels(canvas, 3);
    imageTensor = imageTensor.expandDims(0).toFloat().div(tf.scalar(255));
    return model.predict(imageTensor);
  });

  const boxes = await postprocess(
    version,
    outputs,
    anchors,
    numClasses,
    classNames,
    image.constructor.name === 'HTMLVideoElement'
      ? [image.videoHeight, image.videoWidth]
      : [image.height, image.width],
    maxBoxes,
    scoreThreshold,
    iouThreshold,
  );

  tf.dispose(outputs);

  return boxes;
}

async function v1tiny(
  pathOrIOHandler = v1_tiny_model,
  modelUrl = null,
) {
  let model = await _loadModel(pathOrIOHandler, modelUrl);

  return {
    async predict(
      image,
      {
        maxBoxes = MAX_BOXES,
        scoreThreshold = SCORE_THRESHOLD,
        iouThreshold = IOU_THRESHOLD,
        numClasses = voc_classes.length,
        anchors = v1_tiny_anchors,
        classNames = voc_classes,
        inputSize = INPUT_SIZE,
      } = {},
    ) {
      return _predict(
        'v1tiny',
        model,
        image,
        maxBoxes,
        scoreThreshold,
        iouThreshold,
        numClasses,
        anchors,
        classNames,
        inputSize,
      );
    },
    dispose: () => {
      model.dispose();
      model = null;
    },
  };
}

async function v2tiny(
  pathOrIOHandler = v2_tiny_model,
  modelUrl = null,
) {
  let model = await _loadModel(pathOrIOHandler, modelUrl);

  return {
    async predict(
      image,
      {
        maxBoxes = MAX_BOXES,
        scoreThreshold = SCORE_THRESHOLD,
        iouThreshold = IOU_THRESHOLD,
        numClasses = coco_classes.length,
        anchors = v2_tiny_anchors,
        classNames = coco_classes,
        inputSize = INPUT_SIZE,
      } = {},
    ) {
      return _predict(
        'v2tiny',
        model,
        image,
        maxBoxes,
        scoreThreshold,
        iouThreshold,
        numClasses,
        anchors,
        classNames,
        inputSize,
      );
    },
    dispose: () => {
      model.dispose();
      model = null;
    },
  };
}

async function v3tiny(
  pathOrIOHandler = v3_tiny_model,
  modelUrl = null,
) {
  let model = await _loadModel(pathOrIOHandler, modelUrl);

  return {
    async predict(
      image,
      {
        maxBoxes = MAX_BOXES,
        scoreThreshold = SCORE_THRESHOLD,
        iouThreshold = IOU_THRESHOLD,
        numClasses = coco_classes.length,
        anchors = v3_tiny_anchors,
        classNames = coco_classes,
        inputSize = INPUT_SIZE,
      } = {},
    ) {
      return _predict(
        'v3tiny',
        model,
        image,
        maxBoxes,
        scoreThreshold,
        iouThreshold,
        numClasses,
        anchors,
        classNames,
        inputSize,
      );
    },
    dispose: () => {
      model.dispose();
      model = null;
    },
  };
}

async function v3(
  pathOrIOHandler = v3_model,
  modelUrl = null,
) {
  let model = await _loadModel(pathOrIOHandler, modelUrl);

  return {
    async predict(
      image,
      {
        maxBoxes = MAX_BOXES,
        scoreThreshold = SCORE_THRESHOLD,
        iouThreshold = IOU_THRESHOLD,
        numClasses = coco_classes.length,
        anchors = v3_anchors,
        classNames = coco_classes,
        inputSize = INPUT_SIZE,
      } = {},
    ) {
      return _predict(
        'v3',
        model,
        image,
        maxBoxes,
        scoreThreshold,
        iouThreshold,
        numClasses,
        anchors,
        classNames,
        inputSize,
      );
    },
    dispose: () => {
      model.dispose();
      model = null;
    },
  };
}

const yolo = { v1tiny, v2tiny, v3tiny, v3 };
export default yolo;

const voc_classes = [
  'aeroplane',
  'bicycle',
  'bird',
  'boat',
  'bottle',
  'bus',
  'car',
  'cat',
  'chair',
  'cow',
  'diningtable',
  'dog',
  'horse',
  'motorbike',
  'person',
  'pottedplant',
  'sheep',
  'sofa',
  'train',
  'tvmonitor',
];

const coco_classes = [
  'person',
  'bicycle',
  'car',
  'motorbike',
  'aeroplane',
  'bus',
  'train',
  'truck',
  'boat',
  'traffic light',
  'fire hydrant',
  'stop sign',
  'parking meter',
  'bench',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
  'backpack',
  'umbrella',
  'handbag',
  'tie',
  'suitcase',
  'frisbee',
  'skis',
  'snowboard',
  'sports ball',
  'kite',
  'baseball bat',
  'baseball glove',
  'skateboard',
  'surfboard',
  'tennis racket',
  'bottle',
  'wine glass',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  'sandwich',
  'orange',
  'broccoli',
  'carrot',
  'hot dog',
  'pizza',
  'donut',
  'cake',
  'chair',
  'sofa',
  'pottedplant',
  'bed',
  'diningtable',
  'toilet',
  'tvmonitor',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'cell phone',
  'microwave',
  'oven',
  'toaster',
  'sink',
  'refrigerator',
  'book',
  'clock',
  'vase',
  'scissors',
  'teddy bear',
  'hair drier',
  'toothbrush',
];
