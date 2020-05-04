/* eslint-disable no-console */
/* eslint-disable promise/catch-or-return */
/* eslint-disable no-prototype-builtins */

require('isomorphic-fetch');
const fs = require('fs');
const mkdirp = require('mkdirp');
const IMAGENET_CLASSES = require('./imageNetClasses.js');

class DownloaderUtils {
  constructor(storagePath, outputFolder) { this.storagePath = storagePath; this.outputFolder = outputFolder; }

  async saveJson(jsonFileWithPath) {
    mkdirp.sync(this.outputFolder);
    let modelJson;
    modelJson = await fetch(`${this.storagePath}/${jsonFileWithPath}`);
    modelJson = await modelJson.json();
    fs.writeFile(`${this.outputFolder}/${jsonFileWithPath}`, JSON.stringify(modelJson), () => console.log(`downloading model: ${this.storagePath}`));
    return modelJson;
  }

  async saveWeights(modelJson) {
    if (!modelJson.hasOwnProperty('weightsManifest')) {
      console.log('warning: no weightsManifest property found, checking modelJson instead');
      if (Array.isArray(modelJson) === true) {
        modelJson.forEach((weights) => {
          if (!weights.hasOwnProperty('paths')) return;
          const weightsPromiseArray = weights.paths.map((fileName) => this.saveWeight(fileName));
          Promise.all(weightsPromiseArray);
        });
        return;
      }
      console.log('error: no weightsManifest property found and no paths property');
      return;
    }
    modelJson.weightsManifest.forEach((weights) => {
      const weightsPromiseArray = weights.paths.map((fileName) => this.saveWeight(fileName));
      Promise.all(weightsPromiseArray);
    });
  }

  async saveWeight(fileName) {
    let weightFile;
    const weightUrl = `${this.storagePath}/${fileName}`;
    weightFile = await fetch(weightUrl);
    weightFile = await weightFile.buffer();
    // fs.writeFile(`${this.outputFolder}/${fileName}`, weightFile, () => console.log(`writing: ${this.outputFolder}/${fileName}`));
    fs.writeFileSync(`${this.outputFolder}/${fileName}`, weightFile);
  }
}

async function downloadModel(URI, folder) {
  const downloaderUtils = new DownloaderUtils(URI, folder);
  const modelJson = await downloaderUtils.saveJson('model.json');
  await downloaderUtils.saveWeights(modelJson);
}

function getImagenetPath(mobilenetVersion) {
  let ver = '';
  switch (mobilenetVersion) {
    case 'mobilenet_v1_0.25_224': ver = 'mobilenet_v1_025_224'; break;
    case 'mobilenet_v1_0.50_224': ver = 'mobilenet_v1_050_224'; break;
    case 'mobilenet_v1_0.75_224': ver = 'mobilenet_v1_075_224'; break;
    case 'mobilenet_v1_1.0_224': ver = 'mobilenet_v1_100_224'; break;
    case 'mobilenet_v2_1.0_224': ver = 'mobilenet_v2_100_224'; break;
    default: console.log('must select valid version');
  }
  return {
    storagePath: `https://storage.googleapis.com/tfhub-tfjs-modules/google/imagenet/${ver}/classification/1`,
    outputFolderRoot: `${ver}`,
    outputFolderImagenet: `${ver}/imagenet`,
  };
}

async function downloadMobileNet(storagePath, mobilenetVersion) {
  const mobilenetStoragePath = `${storagePath}/${mobilenetVersion}`;
  const imagenetMeta = getImagenetPath(mobilenetVersion);
  const imagenetStoragePath = imagenetMeta.storagePath;
  const mobilenetOutputFolder = `./models/${imagenetMeta.outputFolderRoot}`;
  const imagenetOutputFolder = `./models/${imagenetMeta.outputFolderImagenet}`;
  const mobilenetDownloader = new DownloaderUtils(mobilenetStoragePath, mobilenetOutputFolder);
  const imagenetDownloader = new DownloaderUtils(imagenetStoragePath, imagenetOutputFolder);
  mkdirp.sync(mobilenetOutputFolder);
  mkdirp.sync(imagenetOutputFolder);
  const modelJson = await mobilenetDownloader.saveJson('model.json');
  await mobilenetDownloader.saveWeights(modelJson);
  const imagenetJson = await imagenetDownloader.saveJson('model.json');
  await imagenetDownloader.saveWeights(imagenetJson);
  const labelArray = Object.values(IMAGENET_CLASSES).map((item) => item);
  const metadataJson = { labels: labelArray };
  await fs.writeFile(`${mobilenetOutputFolder}/metadata.json`, JSON.stringify(metadataJson), () => console.log(`created: ${mobilenetOutputFolder}/metadata.json`));
}

async function downloadAll() {
  await downloadModel('https://raw.githubusercontent.com/ml5js/ml5-data-and-training/master/models/YOLO', './models/yolo');
  await downloadModel('https://raw.githubusercontent.com/shaqian/tfjs-yolo-demo/master/dist/model/v1tiny', './models/yolo-v1-tiny');
  await downloadModel('https://raw.githubusercontent.com/shaqian/tfjs-yolo-demo/master/dist/model/v2tiny', './models/yolo-v2-tiny');
  await downloadModel('https://raw.githubusercontent.com/shaqian/tfjs-yolo-demo/master/dist/model/v3tiny', './models/yolo-v3-tiny');
  await downloadModel('https://raw.githubusercontent.com/shaqian/tfjs-yolo-demo/master/dist/model/v3', './models/yolo-v3');
  await downloadMobileNet('https://storage.googleapis.com/tfjs-models/tfjs', 'mobilenet_v1_0.25_224');
  await downloadMobileNet('https://storage.googleapis.com/tfjs-models/tfjs', 'mobilenet_v1_0.50_224');
  await downloadMobileNet('https://storage.googleapis.com/tfjs-models/tfjs', 'mobilenet_v1_0.75_224');
  await downloadMobileNet('https://storage.googleapis.com/tfjs-models/tfjs', 'mobilenet_v1_1.0_224');
  await downloadMobileNet('https://storage.googleapis.com/tfjs-models/savedmodel', 'mobilenet_v2_1.0_224');
}

downloadAll();
