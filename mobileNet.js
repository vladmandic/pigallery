import * as tf from '@tensorflow/tfjs';
import classesImageNet from './assets/classesImageNet.json';

export default class MobileNet {
  constructor(config) {
    this.modelPath = config.modelPath || null;
    this.score = config.score || 0.2;
    this.squareImage = config.squareImage || false;
    this.MaxImageSize = config.maxImageSize || 800;
    this.topK = config.maxResults || 3;
    this.inputMin = config.inputMin || 0;
    this.inputMax = config.inputMax || 1;
    this.alignCorners = config.alignCorners || true;
    return this;
  }

  async load() {
    this.model = await tf.loadGraphModel(this.modelPath);
    return this.model;
  }

  async getTopK(logits) {
    const softmax = logits.softmax();
    const values = await softmax.data();
    softmax.dispose();
    const valuesAndIndices = [];
    for (let i = 0; i < values.length; i++) valuesAndIndices.push({ value: values[i], index: i });
    valuesAndIndices.sort((a, b) => b.value - a.value);
    const topkValues = new Float32Array(this.topK);
    const topkIndices = new Int32Array(this.topK);
    for (let i = 0; i < this.topK; i++) {
      topkValues[i] = valuesAndIndices[i].value;
      topkIndices[i] = valuesAndIndices[i].index;
    }
    const topClassesAndProbs = [];
    for (let i = 0; i < topkIndices.length; i++) {
      topClassesAndProbs.push({ class: classesImageNet[topkIndices[i]], score: topkValues[i] });
    }
    const filtered = topClassesAndProbs.filter((a) => a.score > this.score);
    return filtered;
  }

  async classify(image) {
    const imgBuf = tf.browser.fromPixels(image, 3);
    const normalized = imgBuf.toFloat().mul((this.inputMax - this.inputMin) / 255.0).add(this.inputMin);
    const resized = tf.image.resizeBilinear(normalized, [224, 224], this.alignCorners);
    const reshaped = resized.reshape([-1, 224, 224, 3]);
    const logits = this.model.predict(reshaped);
    const sliced = logits.slice([0, 1], [-1, 1000]);
    const results = this.getTopK(sliced);
    imgBuf.dispose();
    normalized.dispose();
    resized.dispose();
    reshaped.dispose();
    logits.dispose();
    sliced.dispose();
    return results;
  }
}
