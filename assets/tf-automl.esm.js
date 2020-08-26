/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
import { browser, Tensor, util, image, tidy, dispose } from '@tensorflow/tfjs-core';
import { loadGraphModel } from '@tensorflow/tfjs-converter';

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function imageToTensor(img) {
    return img instanceof Tensor ? img : browser.fromPixels(img);
}
/** Loads and parses the dictionary. */
function loadDictionary(modelUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var lastIndexOfSlash, prefixUrl, dictUrl, response, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lastIndexOfSlash = modelUrl.lastIndexOf('/');
                    prefixUrl = lastIndexOfSlash >= 0 ? modelUrl.slice(0, lastIndexOfSlash + 1) : '';
                    dictUrl = prefixUrl + "dict.txt";
                    return [4 /*yield*/, util.fetch(dictUrl)];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.text()];
                case 2:
                    text = _a.sent();
                    return [2 /*return*/, text.trim().split('\n')];
            }
        });
    });
}

/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
/** Input size as expected by the model. */
var IMG_SIZE = [224, 224];
// Constants used to normalize the image between -1 and 1.
var DIV_FACTOR = 127.5;
var SUB_FACTOR = 1;
var ImageClassificationModel = /** @class */ (function () {
    function ImageClassificationModel(graphModel, dictionary) {
        this.graphModel = graphModel;
        this.dictionary = dictionary;
    }
    ImageClassificationModel.prototype.classify = function (input, options) {
        return __awaiter(this, void 0, void 0, function () {
            var scores, probabilities, result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = sanitizeOptions(options);
                        scores = tidy(function () {
                            var preprocessedImg = _this.preprocess(input, options);
                            return _this.graphModel.predict(preprocessedImg);
                        });
                        return [4 /*yield*/, scores.data()];
                    case 1:
                        probabilities = _a.sent();
                        scores.dispose();
                        result = Array.from(probabilities)
                            .map(function (prob, i) { return ({ label: _this.dictionary[i], prob: prob }); });
                        return [2 /*return*/, result];
                }
            });
        });
    };
    ImageClassificationModel.prototype.preprocess = function (input, options) {
        // Preprocessing involves center crop and normalizing between [-1, 1].
        var img = imageToTensor(input);
        var croppedImg = options.centerCrop ?
            centerCropAndResize(img) :
            image.resizeBilinear(img, IMG_SIZE).expandDims();
        return croppedImg.div(DIV_FACTOR).sub(SUB_FACTOR);
    };
    return ImageClassificationModel;
}());
function loadImageClassification(modelUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, model, dict;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([loadGraphModel(modelUrl), loadDictionary(modelUrl)])];
                case 1:
                    _a = _b.sent(), model = _a[0], dict = _a[1];
                    return [2 /*return*/, new ImageClassificationModel(model, dict)];
            }
        });
    });
}
function sanitizeOptions(options) {
    options = options || {};
    if (options.centerCrop == null) {
        options.centerCrop = true;
    }
    return options;
}
/** Center crops an image */
function centerCropAndResize(img) {
    return tidy(function () {
        var _a = img.shape.slice(0, 2), height = _a[0], width = _a[1];
        var top = 0;
        var left = 0;
        if (height > width) {
            top = (height - width) / 2;
        }
        else {
            left = (width - height) / 2;
        }
        var size = Math.min(width, height);
        var boxes = [
            [top / height, left / width, (top + size) / height, (left + size) / width]
        ];
        var boxIndices = [0];
        return image.cropAndResize(img.toFloat().expandDims(), boxes, boxIndices, IMG_SIZE);
    });
}

/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var DEFAULT_TOPK = 20;
var DEFAULT_IOU_THRESHOLD = 0.5;
var DEFAULT_SCORE_THRESHOLD = 0.5;
var INPUT_NODE_NAME = 'ToFloat';
var OUTPUT_NODE_NAMES = ['Postprocessor/convert_scores', 'Postprocessor/Decode/transpose_1'];
var ObjectDetectionModel = /** @class */ (function () {
    function ObjectDetectionModel(graphModel, dictionary) {
        this.graphModel = graphModel;
        this.dictionary = dictionary;
    }
    ObjectDetectionModel.prototype.detect = function (input, options) {
        return __awaiter(this, void 0, void 0, function () {
            var img, _a, height, width, feedDict, _b, scoresTensor, boxesTensor, _c, numBoxes, numClasses, _d, scores, boxes, _e, boxScores, boxLabels, selectedBoxesTensor, selectedBoxes, result;
            var _this = this;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        options = sanitizeOptions$1(options);
                        img = tidy(function () { return _this.preprocess(input, options); });
                        _a = [img.shape[1], img.shape[2]], height = _a[0], width = _a[1];
                        feedDict = {};
                        feedDict[INPUT_NODE_NAME] = img;
                        return [4 /*yield*/, this.graphModel.executeAsync(feedDict, OUTPUT_NODE_NAMES)];
                    case 1:
                        _b = _f.sent(), scoresTensor = _b[0], boxesTensor = _b[1];
                        _c = scoresTensor.shape, numBoxes = _c[1], numClasses = _c[2];
                        return [4 /*yield*/, Promise.all([scoresTensor.data(), boxesTensor.data()])];
                    case 2:
                        _d = _f.sent(), scores = _d[0], boxes = _d[1];
                        _e = calculateMostLikelyLabels(scores, numBoxes, numClasses), boxScores = _e.boxScores, boxLabels = _e.boxLabels;
                        return [4 /*yield*/, image.nonMaxSuppressionAsync(boxesTensor, boxScores, options.topk, options.iou, options.score)];
                    case 3:
                        selectedBoxesTensor = _f.sent();
                        return [4 /*yield*/, selectedBoxesTensor.data()];
                    case 4:
                        selectedBoxes = _f.sent();
                        dispose([img, scoresTensor, boxesTensor, selectedBoxesTensor]);
                        result = buildDetectedObjects(width, height, boxes, boxScores, boxLabels, selectedBoxes, this.dictionary);
                        return [2 /*return*/, result];
                }
            });
        });
    };
    ObjectDetectionModel.prototype.preprocess = function (input, options) {
        return imageToTensor(input).expandDims().toFloat();
    };
    return ObjectDetectionModel;
}());
function loadObjectDetection(modelUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, model, dict;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([loadGraphModel(modelUrl), loadDictionary(modelUrl)])];
                case 1:
                    _a = _b.sent(), model = _a[0], dict = _a[1];
                    return [2 /*return*/, new ObjectDetectionModel(model, dict)];
            }
        });
    });
}
function sanitizeOptions$1(options) {
    options = options || {};
    if (options.topk == null) {
        options.topk = DEFAULT_TOPK;
    }
    if (options.iou == null) {
        options.iou = DEFAULT_IOU_THRESHOLD;
    }
    if (options.score == null) {
        options.score = DEFAULT_SCORE_THRESHOLD;
    }
    return options;
}
function calculateMostLikelyLabels(scores, numBoxes, numClasses) {
    // Holds a score for each box.
    var boxScores = [];
    // Holds the label id for each box.
    var boxLabels = [];
    for (var i = 0; i < numBoxes; i++) {
        var maxScore = Number.MIN_VALUE;
        var mostLikelyLabel = -1;
        for (var j = 0; j < numClasses; j++) {
            var flatIndex = i * numClasses + j;
            var score = scores[flatIndex];
            if (score > maxScore) {
                maxScore = scores[flatIndex];
                mostLikelyLabel = j;
            }
        }
        boxScores[i] = maxScore;
        boxLabels[i] = mostLikelyLabel;
    }
    return { boxScores: boxScores, boxLabels: boxLabels };
}
function buildDetectedObjects(width, height, boxes, boxScores, boxLabels, selectedBoxes, dictionary) {
    var objects = [];
    // Each 2d rectangle is fully described with 4 coordinates.
    var numBoxCoords = 4;
    for (var i = 0; i < selectedBoxes.length; i++) {
        var boxIndex = selectedBoxes[i];
        var _a = Array.from(boxes.slice(boxIndex * numBoxCoords, boxIndex * numBoxCoords + numBoxCoords)), top_1 = _a[0], left = _a[1], bottom = _a[2], right = _a[3];
        objects.push({
            box: {
                left: left * width,
                top: top_1 * height,
                width: (right - left) * width,
                height: (bottom - top_1) * height,
            },
            label: dictionary[boxLabels[boxIndex]],
            score: boxScores[boxIndex],
        });
    }
    return objects;
}

/** @license See the LICENSE file. */
// This code is auto-generated, do not modify this file!
var version = '1.0.0';

/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

export { ImageClassificationModel, loadImageClassification, loadObjectDetection, ObjectDetectionModel, version };
//# sourceMappingURL=tf-automl.esm.js.map
