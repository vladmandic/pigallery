#!/usr/bin/env -S node --no-deprecation --trace-warnings

const fs = require('fs');
const path = require('path');
const log = require('@vladmandic/pilogger');
// eslint-disable-next-line node/no-unpublished-require, import/no-extraneous-dependencies
const tf = require('@tensorflow/tfjs-node');

async function analyzeGraph(modelPath) {
  const model = await tf.loadGraphModel(`file://${modelPath}`);
  log.info('graph model:', modelPath);
  if (model.modelSignature['inputs']) {
    const inputs = Object.values(model.modelSignature['inputs'])[0];
    log.data('inputs:', { name: inputs.name, dtype: inputs.dtype, shape: inputs.tensorShape.dim });
  } else {
    const inputs = model.modelSignature['inputs'][0];
    log.data('inputs:', { name: inputs.name, dtype: inputs.attrParams.dtype.value, shape: inputs.attrParams.shape.value });
  }
  const outputs = [];
  let i = 0;
  if (model.modelSignature['outputs']) {
    for (const [key, val] of Object.entries(model.modelSignature['outputs'])) {
      outputs.push({ id: i++, name: key, dytpe: val.dtype, shape: val.tensorShape?.dim });
    }
  } else {
    for (const out of model.modelSignature['outputs']) {
      outputs.push({ id: i++, name: out.name });
    }
  }
  log.data('outputs:', outputs);
}

async function analyzeSaved(modelPath) {
  const meta = await tf.node.getMetaGraphsFromSavedModel(modelPath);
  log.info('saved model:', modelPath);
  const sign = Object.values(meta[0].signatureDefs)[0];
  log.data('tags:', meta[0].tags);
  log.data('signature:', Object.keys(meta[0].signatureDefs));
  const inputs = Object.values(sign.inputs)[0];
  log.data('inputs:', { name: inputs.name, dtype: inputs.dtype, dimensions: inputs?.shape?.length });
  const outputs = [];
  let i = 0;
  for (const [key, val] of Object.entries(sign.outputs)) {
    outputs.push({ id: i++, name: key, dytpe: val.dtype, dimensions: val?.shape?.length });
  }
  log.data('outputs:', outputs);
}

async function main() {
  log.header();
  const param = process.argv[2];
  if (process.argv.length !== 3) {
    log.error('path required');
    process.exit(0);
  } else if (!fs.existsSync(param)) {
    log.error(`path does not exist: ${param}`);
    process.exit(0);
  }
  const stat = fs.statSync(param);
  log.data('Stat:', stat.size, 'bytes, created on', stat.birthtime);
  if (stat.isFile()) {
    if (param.endsWith('.json')) analyzeGraph(param);
    // if (param.endsWith('.pb')) analyzeSaved(param);
  }
  if (stat.isDirectory()) {
    if (fs.existsSync(path.join(param, '/saved_model.pb'))) analyzeSaved(param);
    if (fs.existsSync(path.join(param, '/model.json'))) analyzeGraph(path.join(param, '/model.json'));
  }
}

main();
