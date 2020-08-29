(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@tensorflow/tfjs-core')) :
  typeof define === 'function' && define.amd ? define(['exports', '@tensorflow/tfjs-core'], factory) :
  (global = global || self, factory(global.tf = global.tf || {}, global.tf));
}(this, (function (exports, tf) { 'use strict';

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
  const ENV = tf.env();
  /** Whether we submit commands to the device queue immediately. */
  ENV.registerFlag('WEBGPU_IMMEDIATE_EXECUTION_ENABLED', () => true);
  /**
   * Whether we forward execution to the CPU backend if tensors are small and
   * reside on the CPU.
   */
  ENV.registerFlag('WEBGPU_CPU_FORWARD', () => true);
  /**
   * Thread register block size for matmul kernel. If 0, we use the version of
   * matMul without register blocking.
   */
  ENV.registerFlag('WEBGPU_MATMUL_WORK_PER_THREAD', () => 4);
  /**
   * -1: conv2d_naive
   *  0: conv2d_mm with matmul without register blocking
   * >0: conv2d_mm with matmul_packed with WPT=this
   */
  ENV.registerFlag('WEBGPU_CONV2D_WORK_PER_THREAD', () => 2);
  /**
   * Whether we will run im2col as a separate shader for convolution.
   */
  ENV.registerFlag('WEBGPU_CONV_SEPARATE_IM2COL_SHADER', () => false);
  /**
   * Whether we use low power GPU. Otherwise, a high performance GPU will be
   * requested.
   */
  ENV.registerFlag('WEBGPU_USE_LOW_POWER_GPU', () => false);

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
  // Generates GLSL that computes strides.
  function symbolicallyComputeStrides(indicesArr, variableName) {
      if (Math.max(...indicesArr) > 3) {
          throw new Error('Cannot symbolically compute strides for rank > 4 tensor.');
      }
      const numCoords = indicesArr.length;
      const shape = indicesArr.map(d => `${variableName}[${d}]`);
      const strides = new Array(numCoords - 1);
      strides[numCoords - 2] = shape[numCoords - 1];
      for (let i = numCoords - 3; i >= 0; --i) {
          strides[i] = `(${strides[i + 1]} * ${shape[i + 1]})`;
      }
      return strides;
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
  function getCoordsDataType(rank) {
      if (rank <= 1) {
          return 'int';
      }
      else if (rank === 2) {
          return 'ivec2';
      }
      else if (rank === 3) {
          return 'ivec3';
      }
      else if (rank === 4) {
          return 'ivec4';
      }
      else {
          throw Error(`GPU for rank ${rank} is not yet supported`);
      }
  }
  function getShapeCoords(dataShape) {
      const rank = dataShape.length;
      if (rank <= 1) {
          return `int(${dataShape[0]})`;
      }
      else if (rank === 2) {
          return `ivec2(${dataShape[0]}, ${dataShape[1]})`;
      }
      else if (rank === 3) {
          return `ivec3(${dataShape[0]}, ${dataShape[1]}, ${dataShape[2]})`;
      }
      else if (rank === 4) {
          return `ivec4(${dataShape[0]}, ${dataShape[1]}, ${dataShape[2]}, ${dataShape[3]})`;
      }
      else {
          throw Error(`GPU for rank ${rank} is not yet supported`);
      }
  }
  function mapToGlslTypes(type) {
      if (type === 'float32') {
          return 'float';
      }
      if (type === 'int32') {
          return 'int';
      }
      return type;
  }
  function makeShader(inputInfo, outputData, program) {
      const prefixSnippets = [];
      if (program.workGroupSize != null) {
          prefixSnippets.push(`
      layout (local_size_x = ${program.workGroupSize[0]},
              local_size_y = ${program.workGroupSize[1]},
              local_size_z = ${program.workGroupSize[2]}) in;
    `);
      }
      // Output buffer.
      prefixSnippets.push(`
    layout(std430, set = 0, binding = 0) writeonly buffer ssbOut {
      ${mapToGlslTypes(outputData.dtype)} result[];
    };
  `);
      program.variableNames.forEach((x, i) => {
          prefixSnippets.push(`
      layout(std430, set = 0, binding = ${1 + i}) readonly buffer ssb${x} {
        ${mapToGlslTypes(inputInfo[i].dtype)} ${x}[];
      };
    `);
      });
      let uniformDeclaration = '';
      if (program.uniforms) {
          uniformDeclaration += program.uniforms;
          prefixSnippets.push(`
    layout(std140, set = 0, binding = ${1 + program.variableNames.length}) uniform Uniforms {
      ${uniformDeclaration}
    };
  `);
      }
      const [getOutputCoords, dispatchLayoutRank] = generateGetOutputCoords(outputData.shape, program.dispatchLayout);
      const getCoords = generateGetCoordsFromFlatIndex(outputData.shape);
      const sources = [
          SHADER_PREFIX, prefixSnippets.join('\n'), SAMPLING_SNIPPETS,
          getOutputCoords, getCoords,
          getSetOutputSnippet(outputData.shape, outputData.dtype)
      ];
      if (dispatchLayoutRank === outputData.shape.length) {
          // Input sampling snippet is only meaningful when the output isn't getting
          // implicitly reshaped (like it does in conv2d_matmul).
          const inputSamplingSnippet = inputInfo.map(x => getInputSamplingSnippet(x, outputData.shape))
              .join('\n');
          sources.push(inputSamplingSnippet);
      }
      sources.push(program.userCode);
      const source = sources.join('\n');
      return source;
  }
  const SHADER_PREFIX = `#version 450

  int idiv(int a, int b, float sign) {
    int res = a / b;
    int mod = a % b;
    if (sign < 0. && mod != 0) {
      res -= 1;
    }
    return res;
  }

  // Checks whether coordinates lie within the bounds of the shape.
  bool coordsInBounds(ivec4 coord, ivec4 shape) {
    return all(greaterThanEqual(coord, ivec4(0))) &&
        all(lessThan(coord, shape));
  }

  bool coordsInBounds(ivec3 coord, ivec3 shape) {
    return all(greaterThanEqual(coord, ivec3(0))) &&
        all(lessThan(coord, shape));
  }

  bool coordsInBounds(ivec2 coord, ivec2 shape) {
    return all(greaterThanEqual(coord, ivec2(0))) &&
        all(lessThan(coord, shape));
  }
`;
  const SAMPLING_SNIPPETS = `
  int getFlatIndex(int coord, int shape) {
    return coord;
  }

  int getFlatIndex(ivec2 coords, ivec2 shape) {
    return int(dot(coords, ivec2(shape.y, 1.)));
  }

  int getFlatIndex(ivec3 coords, ivec3 shape) {
    return int(dot(coords, ivec3(shape.y * shape.z, shape.z, 1.)));
  }

  int getFlatIndex(ivec4 coords, ivec4 shape) {
    return int(dot(coords, ivec4(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1.)));
  }
`;
  function getSetOutputSnippet(outShape, outBufferType) {
      const outRank = outShape.length;
      const glslType = mapToGlslTypes(outBufferType);
      let snippet = `void setOutput(int flatIndex, float value) {
      result[flatIndex] = ${glslType === 'int' ? 'int(value)' :
        (glslType === 'bool' ? 'bool(value)' : 'value')};
    }
    void setOutput(int flatIndex, int value) {
      result[flatIndex] = ${glslType === 'float' ? 'float(value)' :
        (glslType === 'bool' ? 'bool(value)' : 'value')};
    }`;
      if (outRank >= 2) {
          const dims = ['d0', 'd1', 'd2', 'd3'].slice(0, outRank);
          const type = getCoordsDataType(outRank);
          snippet += `
      void setOutput(${dims.map(d => `int ${d}`).join(', ')}, float value) {
        int flatIndex = getFlatIndex(${type}(${dims.join(', ')}), ${getShapeCoords(outShape)});
        setOutput(flatIndex, value);
      }
      void setOutput(${dims.map(d => `int ${d}`).join(', ')}, int value) {
        int flatIndex = getFlatIndex(${type}(${dims.join(', ')}), ${getShapeCoords(outShape)});
        setOutput(flatIndex, value);
      }
    `;
      }
      return snippet;
  }
  function getInputSamplingSnippet(inInfo, outShape) {
      let res = getSamplerFromInInfo(inInfo);
      const inShape = inInfo.shape;
      if (inShape.length <= outShape.length) {
          res += getSamplerAtOutputCoords(inInfo, outShape);
      }
      return res;
  }
  function getSamplerFromInInfo(inInfo) {
      const texName = inInfo.name;
      const rank = inInfo.shape.length;
      const type = getCoordsDataType(rank);
      const funcName = 'get' + texName.charAt(0).toUpperCase() + texName.slice(1);
      const dims = ['d0', 'd1', 'd2', 'd3'].slice(0, rank);
      const inputs = dims.map(d => `int ${d}`).join(', ');
      if (rank < 1) {
          return `
      float ${funcName}() {
        return ${texName}[0];
      }
    `;
      }
      return `
    float ${funcName}(${inputs}) {
      return float(${texName}[getFlatIndex(${type}(${dims.join(',')}),
        ${getShapeCoords(inInfo.shape)})]);
    }
  `;
  }
  function getSamplerAtOutputCoords(inInfo, outShape) {
      const texName = inInfo.name;
      const texFuncSnippet = texName.charAt(0).toUpperCase() + texName.slice(1);
      const funcName = 'get' + texFuncSnippet + 'AtOutCoords';
      const inRank = inInfo.shape.length;
      const outRank = outShape.length;
      const type = getCoordsDataType(outRank);
      const broadcastDims = tf.backend_util.getBroadcastDims(inInfo.shape, outShape);
      const rankDiff = outRank - inRank;
      let coordsSnippet = '';
      if (inRank === 0) {
          return `
      float ${funcName}() {
        return get${texFuncSnippet}();
      }

      float ${funcName}(${type} coords) {
        return get${texFuncSnippet}();
      }
    `;
      }
      else {
          if (outRank < 2 && broadcastDims.length >= 1) {
              coordsSnippet = 'coords = 0;';
          }
          else {
              coordsSnippet =
                  broadcastDims.map(d => `coords[${d + rankDiff}] = 0;`).join('\n');
          }
      }
      let unpackedCoordsSnippet = '';
      if (outRank < 2 && inRank > 0) {
          unpackedCoordsSnippet = 'coords';
      }
      else {
          if (outRank > 1) {
              const coordsType = getCoordsDataType(inRank);
              const coordsValues = inInfo.shape.map((s, i) => `coords[${i + rankDiff}]`).join(', ');
              unpackedCoordsSnippet = `${coordsType}(${coordsValues})`;
          }
          else {
              unpackedCoordsSnippet = 'coords';
          }
      }
      return `
    float ${funcName}() {
      ${type} coords = getOutputCoords();
      ${coordsSnippet}
      return float(${texName}[getFlatIndex(${unpackedCoordsSnippet}, ${getShapeCoords(inInfo.shape)})]);
    }

    float ${funcName}(${type} coords) {
      ${coordsSnippet}
      return float(${texName}[getFlatIndex(${unpackedCoordsSnippet}, ${getShapeCoords(inInfo.shape)})]);
    }
  `;
  }
  /**
   * Generates getOutputCoords() function that computes output coordinates from
   * dispatch geometry to reduce arithmetic.
   */
  function generateGetOutputCoords(outShape, dispatchLayout) {
      const { x, y = [], z = [] } = dispatchLayout;
      let gatherDimensionsStr = '';
      const dims = [x, y, z];
      let rank = 0;
      for (let i = 0; i < dims.length; i++) {
          const arr = dims[i];
          if (arr.length === 0) {
              continue;
          }
          rank += arr.length;
          if (arr.length === 1) {
              gatherDimensionsStr += `int d${arr[0]} =
        int(gl_GlobalInvocationID[${i}]);`;
          }
          else {
              const strides = symbolicallyComputeStrides(arr, `${getShapeCoords(outShape)}`);
              gatherDimensionsStr += `int index${i} =
        int(gl_GlobalInvocationID[${i}]);`;
              for (let j = 0; j < strides.length; j++) {
                  gatherDimensionsStr += `int d${arr[j]} = index${i} / ${strides[j]};`;
                  if (j === strides.length - 1) {
                      gatherDimensionsStr += `int d${arr[j + 1]} = ` +
                          `index${i} - d${arr[j]} * ${strides[j]};`;
                  }
                  else {
                      gatherDimensionsStr += `index${i} -= d${arr[j]} * ${strides[j]};`;
                  }
              }
          }
      }
      const dimensions = [];
      for (let i = 0; i < rank; i++) {
          dimensions.push(`d${i}`);
      }
      const dtype = getCoordsDataType(rank);
      let snippet = `${dtype} getOutputCoords() {
    ${gatherDimensionsStr}
  `;
      if (dimensions.length === 0) {
          snippet += `return ${dtype}(0);}`;
      }
      else {
          snippet += `return ${dtype}(${dimensions.join(',')});}`;
      }
      return [snippet, rank];
  }
  /**
   * Derives logical coordinates from a flat index. Performs integer division with
   * each stride and decrements the index until the index equals the final
   * dimension coordinate.
   */
  function generateGetCoordsFromFlatIndex(shape) {
      const rank = shape.length;
      if (rank <= 1) {
          return `int getCoordsFromFlatIndex(int index) {return index; }`;
      }
      const strides = tf.util.computeStrides(shape);
      const dtype = getCoordsDataType(rank);
      const coords = [];
      for (let i = 0; i < rank; i++) {
          coords.push(`d${i}`);
      }
      const snippet = strides
          .map((stride, i) => {
          const line1 = `int ${coords[i]} = index / ${stride}`;
          const line2 = i === strides.length - 1 ?
              `int ${coords[i + 1]} = index - ${coords[i]} * ${stride}` :
              `index -= ${coords[i]} * ${stride}`;
          return `${line1}; ${line2};`;
      })
          .join('');
      return `
    ${dtype} getCoordsFromFlatIndex(int index) {
      ${snippet}
      return ${dtype}(${coords.join(',')});
    }
  `;
  }

  const arrayProduct = (arr) => {
      let product = 1;
      for (let i = 0; i < arr.length; i++) {
          product *= arr[i];
      }
      return product;
  };
  function tilesFitEvenlyIntoShape(tileSize, shape) {
      if (tileSize.length !== shape.length) {
          throw new Error(`Cannot compute whether rank ${tileSize.length}` +
              ` tiles fit evenly into rank ${shape.length} shape` +
              ` - ranks must match.`);
      }
      return shape.every((dim, dimIdx) => dim % tileSize[dimIdx] === 0);
  }
  // Computes dispatch geometry based on layout of output dimensions and
  // workGroupSize.
  function computeDispatch(layout, outputShape, workGroupSize = [1, 1, 1], elementsPerThread = [1, 1, 1]) {
      return [
          Math.ceil(arrayProduct(layout.x.map(d => outputShape[d])) /
              (workGroupSize[0] * elementsPerThread[0])),
          layout.y ? Math.ceil(arrayProduct(layout.y.map(d => outputShape[d])) /
              (workGroupSize[1] * elementsPerThread[1])) :
              1,
          layout.z ? Math.ceil(arrayProduct(layout.z.map(d => outputShape[d])) /
              (workGroupSize[2] * elementsPerThread[2])) :
              1
      ];
  }
  function computeWorkGroupSizeForConv2d(layout, outputShape) {
      const dim0 = arrayProduct(layout.x.map(d => outputShape[d]));
      const dim1 = arrayProduct(layout.y.map(d => outputShape[d]));
      // TODO(jiajia.qin@intel.com): More fine tune based on outputShape.
      // These are experimental values. Usually, we need to adjust the work group
      // size based on the output shape. For example, when one dimension is smaller
      // than 4, it will be wasteful if we assign a larger size for this dimension,
      // which results lots of threads doing useless work and reduces parallelism
      // of hardware threads. But it is always a balance between work group size
      // and shared memory. If one dimension is too small, such as 1, shared memory
      // will won't be fully utilized.
      if (dim0 <= 4) {
          return [4, 16, 1];
      }
      if (dim1 <= 4) {
          return [16, 4, 1];
      }
      return [16, 16, 1];
  }
  function computeWorkPerThreadForConv2d(layout, outputShape) {
      const dim0 = arrayProduct(layout.x.map(d => outputShape[d]));
      const dim1 = arrayProduct(layout.y.map(d => outputShape[d]));
      // TODO(jiajia.qin@intel.com): More fine tune based on outputShape.
      // The following conditions correspond to the values set in
      // computeWorkGroupSizeForConv2d.
      if (dim0 <= 4) {
          return [1, 2, 1];
      }
      if (dim1 <= 4) {
          return [2, 1, 1];
      }
      if ((dim1 > dim0) && (dim1 / dim0 >= 2)) {
          return [2, 4, 1];
      }
      if ((dim0 > dim1) && (dim0 / dim1 >= 2)) {
          return [4, 2, 1];
      }
      return [2, 2, 1];
  }
  function flatDispatchLayout(shape) {
      return { x: shape.map((d, i) => i) };
  }
  function GPUBytesPerElement(dtype) {
      if (dtype === 'float32' || dtype === 'int32' || dtype === 'bool') {
          return 4;
      }
      else if (dtype === 'complex64') {
          return 8;
      }
      else {
          throw new Error(`Unknown dtype ${dtype}`);
      }
  }
  function ArrayBufferToTypedArray(data, dtype) {
      if (dtype === 'float32') {
          return new Float32Array(data);
      }
      else if (dtype === 'int32') {
          return new Int32Array(data);
      }
      else if (dtype === 'bool') {
          const dataAsInt32Array = new Int32Array(data);
          const boolData = new ArrayBuffer(dataAsInt32Array.length);
          const dataAsTypedArray = new Uint8Array(boolData);
          for (let i = 0; i < dataAsInt32Array.length; i++) {
              dataAsTypedArray[i] = dataAsInt32Array[i];
          }
          return dataAsTypedArray;
      }
      else {
          throw new Error(`Unknown dtype ${dtype}`);
      }
  }

  var webgpu_util = /*#__PURE__*/Object.freeze({
    __proto__: null,
    tilesFitEvenlyIntoShape: tilesFitEvenlyIntoShape,
    computeDispatch: computeDispatch,
    computeWorkGroupSizeForConv2d: computeWorkGroupSizeForConv2d,
    computeWorkPerThreadForConv2d: computeWorkPerThreadForConv2d,
    flatDispatchLayout: flatDispatchLayout,
    GPUBytesPerElement: GPUBytesPerElement,
    ArrayBufferToTypedArray: ArrayBufferToTypedArray
  });

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
  class BinaryOpSharedProgram {
      constructor(op, aShape, bShape, useSharedMemoryWithB) {
          this.variableNames = ['A', 'B'];
          // This is an experimental value when using shared memory.
          const workGroupSizeX = 512;
          this.workGroupSize = [workGroupSizeX, 1, 1];
          this.outputShape = tf.backend_util.assertAndGetBroadcastShape(aShape, bShape);
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          const size = tf.util.sizeFromShape(this.outputShape);
          const lastDimensionSize = useSharedMemoryWithB ? bShape[0] : aShape[0];
          if (lastDimensionSize < 512) {
              this.workPerThread = 1;
          }
          else if (lastDimensionSize < 1024) {
              this.workPerThread = 2;
          }
          else {
              this.workPerThread = 4;
          }
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          const type = getCoordsDataType(this.outputShape.length);
          const sharedIndexSnippet = lastDimensionSize > 1 ? `coords[${this.outputShape.length - 1}]` : '0';
          const accessDataSnippet = useSharedMemoryWithB ?
              `float a = getAAtOutCoords(coords);
         float b = sharedBuf[${sharedIndexSnippet}];` :
              `float a = sharedBuf[${sharedIndexSnippet}];
         float b = getBAtOutCoords(coords);`;
          const sizeFit = size % (workGroupSizeX * this.workPerThread) === 0;
          const writeDataSnippet = sizeFit ?
              `${type} coords = getCoordsFromFlatIndex(flatIndex);

         ${accessDataSnippet}
         setOutput(flatIndex, binaryOperation(a, b));` :
              `if(flatIndex < ${size}) {
            ${type} coords = getCoordsFromFlatIndex(flatIndex);

            ${accessDataSnippet}
            setOutput(flatIndex, binaryOperation(a, b));
          }`;
          this.userCode = `
        float binaryOperation(float a, float b) {
          ${op}
        }

        shared float sharedBuf[${lastDimensionSize}];
        void main() {
          int index = int(gl_GlobalInvocationID.x);
          int localIndex = int(gl_LocalInvocationIndex);

          // Fill in the shared memory buffer. Here we need a loop to make sure
          // that all data in A|B are uploaded when |sharedMemorySize| is larger
          // than work group size.
          while(localIndex < ${lastDimensionSize})
          {
            sharedBuf[localIndex] = ${useSharedMemoryWithB ? 'B' : 'A'}[localIndex];
            localIndex += int(gl_WorkGroupSize.x);
          }
          barrier();

          for(int i = 0; i < ${this.workPerThread}; i++) {
            int flatIndex = index * ${this.workPerThread} + i;

            ${writeDataSnippet}
          }
        }
        `;
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
  class BinaryOpProgram {
      constructor(op, aShape, bShape) {
          this.variableNames = ['A', 'B'];
          // TODO(jiajia.qin@intel.com): Heuristically select a good work group size.
          const workGroupSizeX = 128;
          this.workGroupSize = [workGroupSizeX, 1, 1];
          this.outputShape = tf.backend_util.assertAndGetBroadcastShape(aShape, bShape);
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          const size = tf.util.sizeFromShape(this.outputShape);
          const sizeFit = size % workGroupSizeX === 0;
          const shapesFit = tf.util.arraysEqual(aShape, bShape) && sizeFit;
          this.workPerThread = shapesFit || sizeFit ? 1 : 2;
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          if (shapesFit) {
              this.userCode = `
          float binaryOperation(float a, float b) {
            ${op}
          }

          void main() {
            int index = int(gl_GlobalInvocationID.x);

            float a = A[index];
            float b = B[index];
            setOutput(index, binaryOperation(a, b));
          }
        `;
              this.shaderKey = `binary2${op}`;
          }
          else if (sizeFit) {
              const type = getCoordsDataType(this.outputShape.length);
              this.userCode = `
      float binaryOperation(float a, float b) {
        ${op}
      }

      void main() {
        int index = int(gl_GlobalInvocationID.x);

        ${type} coords = getCoordsFromFlatIndex(index);

        float a = getAAtOutCoords(coords);
        float b = getBAtOutCoords(coords);
        setOutput(index, binaryOperation(a, b));
      }
      `;
          }
          else {
              const type = getCoordsDataType(this.outputShape.length);
              this.userCode = `
      float binaryOperation(float a, float b) {
        ${op}
      }

      void main() {
        int index = int(gl_GlobalInvocationID.x);

        for(int i = 0; i < ${this.workPerThread}; i++) {
          int flatIndex = index * ${this.workPerThread} + i;

          if(flatIndex < ${size}) {
            ${type} coords = getCoordsFromFlatIndex(flatIndex);

            float a = getAAtOutCoords(coords);
            float b = getBAtOutCoords(coords);
            setOutput(flatIndex, binaryOperation(a, b));
          }
        }
      }
      `;
              this.shaderKey = `binary${op}${type}${size}`;
          }
      }
  }

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
  const MUL = 'return a * b;';
  const ADD = 'return a + b;';
  const SUB = 'return a - b;';
  const DIV = 'return a / b;';
  const GREATER = 'return float(a > b);';
  const GREATER_EQUAL = 'return float(a >= b);';
  const LESS = `return float(a < b);`;
  const LESS_EQUAL = `return float(a <= b);`;
  const SQUARED_DIFFERENCE = 'return (a - b) * (a - b);';
  const INT_DIV = `
  float s = sign(a) * sign(b);
  int ia = int(round(a));
  int ib = int(round(b));
  return float(idiv(ia, ib, s));
`;
  const PRELU = `return (a < 0.) ? b * a : a;`;
  const CHECK_NAN_SNIPPET = `
  if (isnan(a)) return a;
  if (isnan(b)) return b;
`;
  const MAX = CHECK_NAN_SNIPPET + `
  return max(a, b);
`;
  function getBinaryProgram(op, aShape, bShape) {
      const useSharedMemoryWithA = aShape.length === 1 && bShape.length > 1 && aShape[0] < 2048;
      const useSharedMemoryWithB = bShape.length === 1 && aShape.length > 1 && bShape[0] < 2048;
      if (useSharedMemoryWithA || useSharedMemoryWithB) {
          return new BinaryOpSharedProgram(op, aShape, bShape, useSharedMemoryWithB);
      }
      else {
          return new BinaryOpProgram(op, aShape, bShape);
      }
  }

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
  function divImpl(a, b, backend) {
      const program = getBinaryProgram(DIV, a.shape, b.shape);
      const output = backend.compileAndRun(program, [a, b]);
      return output;
  }

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
  const divConfig = {
      kernelName: tf.Div,
      backendName: 'webgpu',
      kernelFunc: ({ inputs, backend }) => {
          const { a, b } = inputs;
          const webgpuBackend = backend;
          return divImpl(a, b, webgpuBackend);
      }
  };

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
  class BatchNormProgram {
      constructor(xShape, meanShape, varianceShape, offsetShape, scaleShape, varianceEpsilon) {
          this.variableNames = ['x', 'mean', 'variance'];
          tf.backend_util.assertAndGetBroadcastShape(xShape, meanShape);
          tf.backend_util.assertAndGetBroadcastShape(xShape, varianceShape);
          this.outputShape = xShape;
          this.dispatchLayout = { x: [1, 2], y: [0], z: [3] };
          const dim = this.outputShape.length;
          const coordsDataType = getCoordsDataType(dim);
          let setOutput = 'setOutput(coords[0], coords[1], coords[2], coords[3], value);';
          if (dim === 2) {
              this.dispatchLayout = { x: [1], y: [0], z: [] };
              setOutput = 'setOutput(coords[0], coords[1], value);';
          }
          if (dim === 3) {
              this.dispatchLayout = { x: [1, 2], y: [0], z: [] };
              setOutput = 'setOutput(coords[0], coords[1], coords[2], value);';
          }
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize);
          let offsetSnippet = '0.0';
          if (offsetShape != null) {
              tf.backend_util.assertAndGetBroadcastShape(xShape, offsetShape);
              this.variableNames.push('offset');
              offsetSnippet = 'getOffsetAtOutCoords()';
          }
          let scaleSnippet = '1.0';
          if (scaleShape != null) {
              tf.backend_util.assertAndGetBroadcastShape(xShape, scaleShape);
              this.variableNames.push('scale');
              scaleSnippet = 'getScaleAtOutCoords()';
          }
          this.userCode = `
      void writeResult(${coordsDataType} coords,float value) {
        if (coordsInBounds(coords, ${getShapeCoords(this.outputShape)})) {
          ${setOutput}
        }
      }
      void main() {
        ${coordsDataType} coords = getOutputCoords();
        float x = getXAtOutCoords();
        float mean = getMeanAtOutCoords();
        float variance = getVarianceAtOutCoords();
        float offset = ${offsetSnippet};
        float scale = ${scaleSnippet};
        float inv = scale * inversesqrt(variance + float(${varianceEpsilon}));
        writeResult(coords,dot(vec3(x, -mean, offset), vec3(inv, inv, 1)));
      }
  `;
      }
  }

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
  const fusedBatchNormConfig = {
      kernelName: tf.FusedBatchNorm,
      backendName: 'webgpu',
      kernelFunc: ({ inputs, attrs, backend }) => {
          const { x, scale, offset, mean, variance } = inputs;
          const { varianceEpsilon } = attrs;
          const webGPUBackend = backend;
          const batchNormInputs = [x, mean, variance];
          let offsetShape = null;
          if (offset != null) {
              offsetShape = offset.shape;
              batchNormInputs.push(offset);
          }
          let scaleShape = null;
          if (scale != null) {
              scaleShape = scale.shape;
              batchNormInputs.push(scale);
          }
          const program = new BatchNormProgram(x.shape, mean.shape, variance.shape, offsetShape, scaleShape, varianceEpsilon);
          return webGPUBackend.compileAndRun(program, batchNormInputs);
      }
  };

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
  const nonMaxSuppressionV3Config = {
      kernelName: tf.NonMaxSuppressionV3,
      backendName: 'webgpu',
      kernelFunc: ({ inputs, backend, attrs }) => {
          console.warn('tf.nonMaxSuppression() in webgpu locks the UI thread. ' +
              'Call tf.nonMaxSuppressionAsync() instead');
          const { boxes, scores } = inputs;
          const { maxOutputSize, iouThreshold, scoreThreshold } = attrs;
          const gpuBackend = backend;
          const boxesVals = gpuBackend.readSync(boxes.dataId);
          const scoresVals = gpuBackend.readSync(scores.dataId);
          return tf.kernel_impls.nonMaxSuppressionV3Impl(boxesVals, scoresVals, maxOutputSize, iouThreshold, scoreThreshold);
      }
  };

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
  const nonMaxSuppressionV5Config = {
      kernelName: tf.NonMaxSuppressionV5,
      backendName: 'webgpu',
      kernelFunc: ({ inputs, backend, attrs }) => {
          console.warn('tf.nonMaxSuppression() in webgpu locks the UI thread. ' +
              'Call tf.nonMaxSuppressionAsync() instead');
          const { boxes, scores } = inputs;
          const { maxOutputSize, iouThreshold, scoreThreshold, softNmsSigma } = attrs;
          const gpuBackend = backend;
          const boxesVals = gpuBackend.readSync(boxes.dataId);
          const scoresVals = gpuBackend.readSync(scores.dataId);
          const maxOutputSizeVal = maxOutputSize;
          const iouThresholdVal = iouThreshold;
          const scoreThresholdVal = scoreThreshold;
          const softNmsSigmaVal = softNmsSigma;
          const { selectedIndices, selectedScores } = tf.kernel_impls.nonMaxSuppressionV5Impl(boxesVals, scoresVals, maxOutputSizeVal, iouThresholdVal, scoreThresholdVal, softNmsSigmaVal);
          return [selectedIndices, selectedScores];
      }
  };

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
  const RELU = 'return max(a, 0.0);';
  const RELU6 = 'return (a < 0.0) ? 0.0 : min(6.0, a);';
  const LINEAR = `return a;`;
  const ELU = `return (a >= 0.0) ? a : (exp(a) - 1.0);`;
  const SIGMOID = `return 1.0 / (1.0 + exp(-1.0 * a));`;
  const ABS = `return abs(a);`;
  const SQUARE = `return a * a;`;
  const NEG = `return -a;`;
  const TANH = `
  float e2x = exp(-2.0 * abs(a));
  return sign(a) * (1.0 - e2x) / (1.0 + e2x);
`;
  const EXP = `return exp(a);`;
  const LOG = `if (a < 0.0) return 1.0/0.0;
  return log(a);`;
  class UnaryOpProgram {
      constructor(outputShape, op) {
          this.variableNames = ['A'];
          // TODO(jiajia.qin@intel.com): Heuristically select a good work group size.
          const workGroupSizeX = 128;
          this.workGroupSize = [workGroupSizeX, 1, 1];
          this.outputShape = outputShape;
          const size = tf.util.sizeFromShape(this.outputShape);
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          const fit = size % workGroupSizeX === 0;
          this.workPerThread = fit ? 1 : 2;
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          if (fit) {
              this.userCode = `
      float unaryOperation(float a) {
        ${op}
      }

      void main() {
        int index = int(gl_GlobalInvocationID.x);
        float a = A[index];
        setOutput(index, unaryOperation(a));;
      }
      `;
              this.shaderKey = `unary2${op}`;
          }
          else {
              const type = getCoordsDataType(this.outputShape.length);
              this.userCode = `
      float unaryOperation(float a) {
        ${op}
      }

      void main() {
        int index = int(gl_GlobalInvocationID.x);

        for(int i = 0; i < ${this.workPerThread}; i++) {
          int flatIndex = index * ${this.workPerThread} + i;

          if(flatIndex < ${size}) {
            ${type} coords = getCoordsFromFlatIndex(flatIndex);

            float a = getAAtOutCoords(coords);
            setOutput(flatIndex, unaryOperation(a));
          }
        }
      }
      `;
              this.shaderKey = `unary${op}${type}${size}`;
          }
      }
  }

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
  const squareConfig = {
      kernelName: tf.Square,
      backendName: 'webgpu',
      kernelFunc: ({ inputs, backend }) => {
          const { x } = inputs;
          const webGPUBackend = backend;
          const program = new UnaryOpProgram(x.shape, SQUARE);
          return webGPUBackend.compileAndRun(program, [x]);
      }
  };

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
  const squaredDifferenceConfig = {
      kernelName: tf.SquaredDifference,
      backendName: 'webgpu',
      kernelFunc: ({ inputs, backend }) => {
          const { a, b } = inputs;
          const webGPUBackend = backend;
          const program = getBinaryProgram(SQUARED_DIFFERENCE, a.shape, b.shape);
          return webGPUBackend.compileAndRun(program, [a, b]);
      }
  };

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
  // List all kernel configs here
  const kernelConfigs = [
      divConfig,
      squareConfig,
      squaredDifferenceConfig,
      fusedBatchNormConfig,
      nonMaxSuppressionV3Config,
      nonMaxSuppressionV5Config,
  ];
  for (const kernelConfig of kernelConfigs) {
      tf.registerKernel(kernelConfig);
  }


  var Module = (function() {
    var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
    return (
  function(Module) {
    Module = Module || {};

  var d;d||(d=typeof Module !== 'undefined' ? Module : {});d.compileGLSLZeroCopy=function(a,b,c){c=!!c;if("vertex"===b)var e=0;else if("fragment"===b)e=4;else if("compute"===b)e=5;else throw Error("shader_stage must be 'vertex', 'fragment', or 'compute'");b=d._malloc(4);var g=d._malloc(4),f=aa([a,e,c,b,g]);c=ba(b);a=ba(g);d._free(b);d._free(g);if(0===f)throw Error("GLSL compilation failed");b={};g=c/4;b.data=d.HEAPU32.subarray(g,g+a);b.free=function(){d._destroy_output_buffer(f);};return b};
  d.compileGLSL=function(a,b,c){a=d.compileGLSLZeroCopy(a,b,c);b=a.data.slice();a.free();return b};var k={},p;for(p in d)d.hasOwnProperty(p)&&(k[p]=d[p]);var ca="./this.program",r=!1,t=!1;r="object"===typeof window;t="function"===typeof importScripts;var u="",w;
  if(r||t)t?u=self.location.href:document.currentScript&&(u=document.currentScript.src),_scriptDir&&(u=_scriptDir),0!==u.indexOf("blob:")?u=u.substr(0,u.lastIndexOf("/")+1):u="",t&&(w=function(a){var b=new XMLHttpRequest;b.open("GET",a,!1);b.responseType="arraybuffer";b.send(null);return new Uint8Array(b.response)});var da=d.print||console.log.bind(console),x=d.printErr||console.warn.bind(console);for(p in k)k.hasOwnProperty(p)&&(d[p]=k[p]);k=null;d.thisProgram&&(ca=d.thisProgram);var y;
  d.wasmBinary&&(y=d.wasmBinary);"object"!==typeof WebAssembly&&x("no native wasm support detected");function ba(a){var b="i32";"*"===b.charAt(b.length-1)&&(b="i32");switch(b){case "i1":return z[a>>0];case "i8":return z[a>>0];case "i16":return A[a>>1];case "i32":return B[a>>2];case "i64":return B[a>>2];case "float":return C[a>>2];case "double":return D[a>>3];default:E("invalid type for getValue: "+b);}return null}var F,ea=new WebAssembly.Table({initial:861,maximum:861,element:"anyfunc"}),fa=!1;
  function ha(){var a=d._convert_glsl_to_spirv;a||E("Assertion failed: Cannot call unknown function convert_glsl_to_spirv, make sure it is exported");return a}
  function aa(a){var b=["string","number","boolean","number","number"],c={string:function(a){var b=0;if(null!==a&&void 0!==a&&0!==a){var c=(a.length<<2)+1;b=ia(c);G(a,H,b,c);}return b},array:function(a){var b=ia(a.length);z.set(a,b);return b}},e=ha(),g=[],f=0;if(a)for(var h=0;h<a.length;h++){var m=c[b[h]];m?(0===f&&(f=ja()),g[h]=m(a[h])):g[h]=a[h];}a=e.apply(null,g);0!==f&&ka(f);return a}var la="undefined"!==typeof TextDecoder?new TextDecoder("utf8"):void 0;
  function ma(a,b,c){var e=b+c;for(c=b;a[c]&&!(c>=e);)++c;if(16<c-b&&a.subarray&&la)return la.decode(a.subarray(b,c));for(e="";b<c;){var g=a[b++];if(g&128){var f=a[b++]&63;if(192==(g&224))e+=String.fromCharCode((g&31)<<6|f);else {var h=a[b++]&63;g=224==(g&240)?(g&15)<<12|f<<6|h:(g&7)<<18|f<<12|h<<6|a[b++]&63;65536>g?e+=String.fromCharCode(g):(g-=65536,e+=String.fromCharCode(55296|g>>10,56320|g&1023));}}else e+=String.fromCharCode(g);}return e}function I(a){return a?ma(H,a,void 0):""}
  function G(a,b,c,e){if(0<e){e=c+e-1;for(var g=0;g<a.length;++g){var f=a.charCodeAt(g);if(55296<=f&&57343>=f){var h=a.charCodeAt(++g);f=65536+((f&1023)<<10)|h&1023;}if(127>=f){if(c>=e)break;b[c++]=f;}else {if(2047>=f){if(c+1>=e)break;b[c++]=192|f>>6;}else {if(65535>=f){if(c+2>=e)break;b[c++]=224|f>>12;}else {if(c+3>=e)break;b[c++]=240|f>>18;b[c++]=128|f>>12&63;}b[c++]=128|f>>6&63;}b[c++]=128|f&63;}}b[c]=0;}}
  function na(a){for(var b=0,c=0;c<a.length;++c){var e=a.charCodeAt(c);55296<=e&&57343>=e&&(e=65536+((e&1023)<<10)|a.charCodeAt(++c)&1023);127>=e?++b:b=2047>=e?b+2:65535>=e?b+3:b+4;}return b}"undefined"!==typeof TextDecoder&&new TextDecoder("utf-16le");function oa(a){0<a%65536&&(a+=65536-a%65536);return a}var J,z,H,A,pa,B,K,C,D;
  function qa(a){J=a;d.HEAP8=z=new Int8Array(a);d.HEAP16=A=new Int16Array(a);d.HEAP32=B=new Int32Array(a);d.HEAPU8=H=new Uint8Array(a);d.HEAPU16=pa=new Uint16Array(a);d.HEAPU32=K=new Uint32Array(a);d.HEAPF32=C=new Float32Array(a);d.HEAPF64=D=new Float64Array(a);}var ra=d.TOTAL_MEMORY||16777216;d.wasmMemory?F=d.wasmMemory:F=new WebAssembly.Memory({initial:ra/65536});F&&(J=F.buffer);ra=J.byteLength;qa(J);B[79464]=5560896;
  function L(a){for(;0<a.length;){var b=a.shift();if("function"==typeof b)b();else {var c=b.T;"number"===typeof c?void 0===b.R?d.dynCall_v(c):d.dynCall_vi(c,b.R):c(void 0===b.R?null:b.R);}}}var sa=[],ta=[],ua=[],va=[];function wa(){var a=d.preRun.shift();sa.unshift(a);}var M=0,N=null;d.preloadedImages={};d.preloadedAudios={};function E(a){if(d.onAbort)d.onAbort(a);da(a);x(a);fa=!0;throw new WebAssembly.RuntimeError("abort("+a+"). Build with -s ASSERTIONS=1 for more info.");}
  function ya(){var a=O;return String.prototype.startsWith?a.startsWith("data:application/octet-stream;base64,"):0===a.indexOf("data:application/octet-stream;base64,")}var O=wasmuri;if(!ya()){var za=O;O=d.locateFile?d.locateFile(za,u):u+za;}function Aa(){try{if(y)return new Uint8Array(y);if(w)return w(O);throw "both async and sync fetching of the wasm failed";}catch(a){E(a);}}
  function Ba(){return y||!r&&!t||"function"!==typeof fetch?new Promise(function(a){a(Aa());}):fetch(O,{credentials:"same-origin"}).then(function(a){if(!a.ok)throw "failed to load wasm binary file at '"+O+"'";return a.arrayBuffer()}).catch(function(){return Aa()})}ta.push({T:function(){Ca();}});var Da=[null,[],[]],Ea=0;function Fa(){Ea+=4;return B[Ea-4>>2]}var Ga={};
  function Ha(a){switch(a){case 1:return 0;case 2:return 1;case 4:return 2;case 8:return 3;default:throw new TypeError("Unknown type size: "+a);}}var Ia=void 0;function P(a){for(var b="";H[a];)b+=Ia[H[a++]];return b}var Ja={},Ka={};function Na(a,b){if(void 0===a)a="_unknown";else {a=a.replace(/[^a-zA-Z0-9_]/g,"$");var c=a.charCodeAt(0);a=48<=c&&57>=c?"_"+a:a;}return (new Function("body","return function "+a+'() {\n    "use strict";    return body.apply(this, arguments);\n};\n'))(b)}
  function Oa(a){var b=Error,c=Na(a,function(b){this.name=a;this.message=b;b=Error(b).stack;void 0!==b&&(this.stack=this.toString()+"\n"+b.replace(/^Error(:[^\n]*)?\n/,""));});c.prototype=Object.create(b.prototype);c.prototype.constructor=c;c.prototype.toString=function(){return void 0===this.message?this.name:this.name+": "+this.message};return c}var Pa=void 0;function Q(a){throw new Pa(a);}
  function R(a,b,c){c=c||{};if(!("argPackAdvance"in b))throw new TypeError("registerType registeredInstance requires argPackAdvance");var e=b.name;a||Q('type "'+e+'" must have a positive integer typeid pointer');if(Ka.hasOwnProperty(a)){if(c.U)return;Q("Cannot register type '"+e+"' twice");}Ka[a]=b;Ja.hasOwnProperty(a)&&(b=Ja[a],delete Ja[a],b.forEach(function(a){a();}));}var Qa=[],S=[{},{value:void 0},{value:null},{value:!0},{value:!1}];
  function Ra(a){switch(a){case void 0:return 1;case null:return 2;case !0:return 3;case !1:return 4;default:var b=Qa.length?Qa.pop():S.length;S[b]={W:1,value:a};return b}}function Sa(a){return this.fromWireType(K[a>>2])}function Ta(a){if(null===a)return "null";var b=typeof a;return "object"===b||"array"===b||"function"===b?a.toString():""+a}
  function Ua(a,b){switch(b){case 2:return function(a){return this.fromWireType(C[a>>2])};case 3:return function(a){return this.fromWireType(D[a>>3])};default:throw new TypeError("Unknown float type: "+a);}}
  function Va(a,b,c){switch(b){case 0:return c?function(a){return z[a]}:function(a){return H[a]};case 1:return c?function(a){return A[a>>1]}:function(a){return pa[a>>1]};case 2:return c?function(a){return B[a>>2]}:function(a){return K[a>>2]};default:throw new TypeError("Unknown integer type: "+a);}}var Wa={};
  function Xa(){if(!Ya){var a={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:("object"===typeof navigator&&navigator.languages&&navigator.languages[0]||"C").replace("-","_")+".UTF-8",_:ca},b;for(b in Wa)a[b]=Wa[b];var c=[];for(b in a)c.push(b+"="+a[b]);Ya=c;}return Ya}var Ya;function T(a){return 0===a%4&&(0!==a%100||0===a%400)}function Za(a,b){for(var c=0,e=0;e<=b;c+=a[e++]);return c}var U=[31,29,31,30,31,30,31,31,30,31,30,31],V=[31,28,31,30,31,30,31,31,30,31,30,31];
  function W(a,b){for(a=new Date(a.getTime());0<b;){var c=a.getMonth(),e=(T(a.getFullYear())?U:V)[c];if(b>e-a.getDate())b-=e-a.getDate()+1,a.setDate(1),11>c?a.setMonth(c+1):(a.setMonth(0),a.setFullYear(a.getFullYear()+1));else {a.setDate(a.getDate()+b);break}}return a}
  function $a(a,b,c,e){function g(a,b,c){for(a="number"===typeof a?a.toString():a||"";a.length<b;)a=c[0]+a;return a}function f(a,b){return g(a,b,"0")}function h(a,b){function c(a){return 0>a?-1:0<a?1:0}var f;0===(f=c(a.getFullYear()-b.getFullYear()))&&0===(f=c(a.getMonth()-b.getMonth()))&&(f=c(a.getDate()-b.getDate()));return f}function m(a){switch(a.getDay()){case 0:return new Date(a.getFullYear()-1,11,29);case 1:return a;case 2:return new Date(a.getFullYear(),0,3);case 3:return new Date(a.getFullYear(),
  0,2);case 4:return new Date(a.getFullYear(),0,1);case 5:return new Date(a.getFullYear()-1,11,31);case 6:return new Date(a.getFullYear()-1,11,30)}}function q(a){a=W(new Date(a.J+1900,0,1),a.P);var b=m(new Date(a.getFullYear()+1,0,4));return 0>=h(m(new Date(a.getFullYear(),0,4)),a)?0>=h(b,a)?a.getFullYear()+1:a.getFullYear():a.getFullYear()-1}var l=B[e+40>>2];e={Z:B[e>>2],Y:B[e+4>>2],N:B[e+8>>2],M:B[e+12>>2],K:B[e+16>>2],J:B[e+20>>2],O:B[e+24>>2],P:B[e+28>>2],ia:B[e+32>>2],X:B[e+36>>2],$:l?I(l):""};
  c=I(c);l={"%c":"%a %b %d %H:%M:%S %Y","%D":"%m/%d/%y","%F":"%Y-%m-%d","%h":"%b","%r":"%I:%M:%S %p","%R":"%H:%M","%T":"%H:%M:%S","%x":"%m/%d/%y","%X":"%H:%M:%S","%Ec":"%c","%EC":"%C","%Ex":"%m/%d/%y","%EX":"%H:%M:%S","%Ey":"%y","%EY":"%Y","%Od":"%d","%Oe":"%e","%OH":"%H","%OI":"%I","%Om":"%m","%OM":"%M","%OS":"%S","%Ou":"%u","%OU":"%U","%OV":"%V","%Ow":"%w","%OW":"%W","%Oy":"%y"};for(var n in l)c=c.replace(new RegExp(n,"g"),l[n]);var v="Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" "),
  La="January February March April May June July August September October November December".split(" ");l={"%a":function(a){return v[a.O].substring(0,3)},"%A":function(a){return v[a.O]},"%b":function(a){return La[a.K].substring(0,3)},"%B":function(a){return La[a.K]},"%C":function(a){return f((a.J+1900)/100|0,2)},"%d":function(a){return f(a.M,2)},"%e":function(a){return g(a.M,2," ")},"%g":function(a){return q(a).toString().substring(2)},"%G":function(a){return q(a)},"%H":function(a){return f(a.N,2)},
  "%I":function(a){a=a.N;0==a?a=12:12<a&&(a-=12);return f(a,2)},"%j":function(a){return f(a.M+Za(T(a.J+1900)?U:V,a.K-1),3)},"%m":function(a){return f(a.K+1,2)},"%M":function(a){return f(a.Y,2)},"%n":function(){return "\n"},"%p":function(a){return 0<=a.N&&12>a.N?"AM":"PM"},"%S":function(a){return f(a.Z,2)},"%t":function(){return "\t"},"%u":function(a){return a.O||7},"%U":function(a){var b=new Date(a.J+1900,0,1),c=0===b.getDay()?b:W(b,7-b.getDay());a=new Date(a.J+1900,a.K,a.M);return 0>h(c,a)?f(Math.ceil((31-
  c.getDate()+(Za(T(a.getFullYear())?U:V,a.getMonth()-1)-31)+a.getDate())/7),2):0===h(c,b)?"01":"00"},"%V":function(a){var b=m(new Date(a.J+1900,0,4)),c=m(new Date(a.J+1901,0,4)),e=W(new Date(a.J+1900,0,1),a.P);return 0>h(e,b)?"53":0>=h(c,e)?"01":f(Math.ceil((b.getFullYear()<a.J+1900?a.P+32-b.getDate():a.P+1-b.getDate())/7),2)},"%w":function(a){return a.O},"%W":function(a){var b=new Date(a.J,0,1),c=1===b.getDay()?b:W(b,0===b.getDay()?1:7-b.getDay()+1);a=new Date(a.J+1900,a.K,a.M);return 0>h(c,a)?f(Math.ceil((31-
  c.getDate()+(Za(T(a.getFullYear())?U:V,a.getMonth()-1)-31)+a.getDate())/7),2):0===h(c,b)?"01":"00"},"%y":function(a){return (a.J+1900).toString().substring(2)},"%Y":function(a){return a.J+1900},"%z":function(a){a=a.X;var b=0<=a;a=Math.abs(a)/60;return (b?"+":"-")+String("0000"+(a/60*100+a%60)).slice(-4)},"%Z":function(a){return a.$},"%%":function(){return "%"}};for(n in l)0<=c.indexOf(n)&&(c=c.replace(new RegExp(n,"g"),l[n](e)));n=ab(c);if(n.length>b)return 0;z.set(n,a);return n.length-1}
  for(var bb=Array(256),X=0;256>X;++X)bb[X]=String.fromCharCode(X);Ia=bb;Pa=d.BindingError=Oa("BindingError");d.InternalError=Oa("InternalError");d.count_emval_handles=function(){for(var a=0,b=5;b<S.length;++b)void 0!==S[b]&&++a;return a};d.get_first_emval=function(){for(var a=5;a<S.length;++a)if(void 0!==S[a])return S[a];return null};function ab(a){var b=Array(na(a)+1);G(a,b,0,b.length);return b}
  var db={j:function(){},g:function(){d.___errno_location&&(B[d.___errno_location()>>2]=63);return -1},v:function(a,b){Ea=b;try{var c=Fa();var e=Fa();if(-1===c||0===e)var g=-28;else {var f=Ga.V[c];if(f&&e===f.fa){var h=(void 0).da(f.ca);Ga.ba(c,h,e,f.flags);(void 0).ha(h);Ga.V[c]=null;f.aa&&Y(f.ga);}g=0;}return g}catch(m){return E(m),-m.S}},d:function(){},s:function(a,b,c,e,g){var f=Ha(c);b=P(b);R(a,{name:b,fromWireType:function(a){return !!a},toWireType:function(a,b){return b?e:g},argPackAdvance:8,readValueFromPointer:function(a){if(1===
  c)var e=z;else if(2===c)e=A;else if(4===c)e=B;else throw new TypeError("Unknown boolean type size: "+b);return this.fromWireType(e[a>>f])},L:null});},q:function(a,b){b=P(b);R(a,{name:b,fromWireType:function(a){var b=S[a].value;4<a&&0===--S[a].W&&(S[a]=void 0,Qa.push(a));return b},toWireType:function(a,b){return Ra(b)},argPackAdvance:8,readValueFromPointer:Sa,L:null});},e:function(a,b,c){c=Ha(c);b=P(b);R(a,{name:b,fromWireType:function(a){return a},toWireType:function(a,b){if("number"!==typeof b&&"boolean"!==
  typeof b)throw new TypeError('Cannot convert "'+Ta(b)+'" to '+this.name);return b},argPackAdvance:8,readValueFromPointer:Ua(b,c),L:null});},b:function(a,b,c,e,g){function f(a){return a}b=P(b);-1===g&&(g=4294967295);var h=Ha(c);if(0===e){var m=32-8*c;f=function(a){return a<<m>>>m};}var q=-1!=b.indexOf("unsigned");R(a,{name:b,fromWireType:f,toWireType:function(a,c){if("number"!==typeof c&&"boolean"!==typeof c)throw new TypeError('Cannot convert "'+Ta(c)+'" to '+this.name);if(c<e||c>g)throw new TypeError('Passing a number "'+
  Ta(c)+'" from JS side to C/C++ side to an argument of type "'+b+'", which is outside the valid range ['+e+", "+g+"]!");return q?c>>>0:c|0},argPackAdvance:8,readValueFromPointer:Va(b,h,0!==e),L:null});},a:function(a,b,c){function e(a){a>>=2;var b=K;return new g(b.buffer,b[a+1],b[a])}var g=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array][b];c=P(c);R(a,{name:c,fromWireType:e,argPackAdvance:8,readValueFromPointer:e},{U:!0});},f:function(a,b){b=P(b);var c="std::string"===
  b;R(a,{name:b,fromWireType:function(a){var b=K[a>>2];if(c){var f=H[a+4+b],e=0;0!=f&&(e=f,H[a+4+b]=0);var m=a+4;for(f=0;f<=b;++f){var q=a+4+f;if(0==H[q]){m=I(m);if(void 0===l)var l=m;else l+=String.fromCharCode(0),l+=m;m=q+1;}}0!=e&&(H[a+4+b]=e);}else {l=Array(b);for(f=0;f<b;++f)l[f]=String.fromCharCode(H[a+4+f]);l=l.join("");}Y(a);return l},toWireType:function(a,b){b instanceof ArrayBuffer&&(b=new Uint8Array(b));var f="string"===typeof b;f||b instanceof Uint8Array||b instanceof Uint8ClampedArray||b instanceof
  Int8Array||Q("Cannot pass non-string to std::string");var e=(c&&f?function(){return na(b)}:function(){return b.length})(),g=cb(4+e+1);K[g>>2]=e;if(c&&f)G(b,H,g+4,e+1);else if(f)for(f=0;f<e;++f){var q=b.charCodeAt(f);255<q&&(Y(g),Q("String has UTF-16 code units that do not fit in 8 bits"));H[g+4+f]=q;}else for(f=0;f<e;++f)H[g+4+f]=b[f];null!==a&&a.push(Y,g);return g},argPackAdvance:8,readValueFromPointer:Sa,L:function(a){Y(a);}});},r:function(a,b,c){c=P(c);if(2===b){var e=function(){return pa};var g=
  1;}else 4===b&&(e=function(){return K},g=2);R(a,{name:c,fromWireType:function(a){for(var b=e(),c=K[a>>2],f=Array(c),l=a+4>>g,n=0;n<c;++n)f[n]=String.fromCharCode(b[l+n]);Y(a);return f.join("")},toWireType:function(a,c){var f=c.length,h=cb(4+f*b),l=e();K[h>>2]=f;for(var n=h+4>>g,v=0;v<f;++v)l[n+v]=c.charCodeAt(v);null!==a&&a.push(Y,h);return h},argPackAdvance:8,readValueFromPointer:Sa,L:function(a){Y(a);}});},t:function(a,b){b=P(b);R(a,{ea:!0,name:b,argPackAdvance:0,fromWireType:function(){},toWireType:function(){}});},
  c:function(){E();},n:function(a,b,c){H.set(H.subarray(b,b+c),a);},o:function(a){if(2147418112<a)return !1;for(var b=Math.max(z.length,16777216);b<a;)536870912>=b?b=oa(2*b):b=Math.min(oa((3*b+2147483648)/4),2147418112);a:{try{F.grow(b-J.byteLength+65535>>16);qa(F.buffer);var c=1;break a}catch(e){}c=void 0;}return c?!0:!1},h:function(a,b){var c=0;Xa().forEach(function(e,g){var f=b+c;g=B[a+4*g>>2]=f;for(f=0;f<e.length;++f)z[g++>>0]=e.charCodeAt(f);z[g>>0]=0;c+=e.length+1;});return 0},i:function(a,b){var c=
  Xa();B[a>>2]=c.length;var e=0;c.forEach(function(a){e+=a.length+1;});B[b>>2]=e;return 0},l:function(){return 0},m:function(){return 0},k:function(a,b,c,e){try{for(var g=0,f=0;f<c;f++){for(var h=B[b+8*f>>2],m=B[b+(8*f+4)>>2],q=0;q<m;q++){var l=H[h+q],n=Da[a];0===l||10===l?((1===a?da:x)(ma(n,0)),n.length=0):n.push(l);}g+=m;}B[e>>2]=g;return 0}catch(v){return E(v),v.S}},memory:F,w:function(){},p:function(){},u:function(a,b,c,e){return $a(a,b,c,e)},table:ea},eb=function(){function a(a){d.asm=a.exports;M--;
  d.monitorRunDependencies&&d.monitorRunDependencies(M);0==M&&(N&&(a=N,N=null,a()));}function b(b){a(b.instance);}function c(a){return Ba().then(function(a){return WebAssembly.instantiate(a,e)}).then(a,function(a){x("failed to asynchronously prepare wasm: "+a);E(a);})}var e={env:db,wasi_unstable:db};M++;d.monitorRunDependencies&&d.monitorRunDependencies(M);if(d.instantiateWasm)try{return d.instantiateWasm(e,a)}catch(g){return x("Module.instantiateWasm callback failed with error: "+
  g),!1}(function(){if(y||"function"!==typeof WebAssembly.instantiateStreaming||ya()||"function"!==typeof fetch)return c(b);fetch(O,{credentials:"same-origin"}).then(function(a){return WebAssembly.instantiateStreaming(a,e).then(b,function(a){x("wasm streaming compile failed: "+a);x("falling back to ArrayBuffer instantiation");c(b);})});})();return {}}();d.asm=eb;var Ca=d.___wasm_call_ctors=function(){return d.asm.x.apply(null,arguments)};d._convert_glsl_to_spirv=function(){return d.asm.y.apply(null,arguments)};
  d._destroy_output_buffer=function(){return d.asm.z.apply(null,arguments)};var cb=d._malloc=function(){return d.asm.A.apply(null,arguments)},Y=d._free=function(){return d.asm.B.apply(null,arguments)};d.___getTypeName=function(){return d.asm.C.apply(null,arguments)};d.___embind_register_native_and_builtin_types=function(){return d.asm.D.apply(null,arguments)};
  var ja=d.stackSave=function(){return d.asm.E.apply(null,arguments)},ia=d.stackAlloc=function(){return d.asm.F.apply(null,arguments)},ka=d.stackRestore=function(){return d.asm.G.apply(null,arguments)};d.dynCall_vi=function(){return d.asm.H.apply(null,arguments)};d.dynCall_v=function(){return d.asm.I.apply(null,arguments)};d.asm=eb;var Z;d.then=function(a){if(Z)a(d);else {var b=d.onRuntimeInitialized;d.onRuntimeInitialized=function(){b&&b();a(d);};}return d};N=function fb(){Z||gb();Z||(N=fb);};
  function gb(){function a(){if(!Z&&(Z=!0,!fa)){L(ta);L(ua);if(d.onRuntimeInitialized)d.onRuntimeInitialized();if(d.postRun)for("function"==typeof d.postRun&&(d.postRun=[d.postRun]);d.postRun.length;){var a=d.postRun.shift();va.unshift(a);}L(va);}}if(!(0<M)){if(d.preRun)for("function"==typeof d.preRun&&(d.preRun=[d.preRun]);d.preRun.length;)wa();L(sa);0<M||(d.setStatus?(d.setStatus("Running..."),setTimeout(function(){setTimeout(function(){d.setStatus("");},1);a();},1)):a());}}d.run=gb;
  if(d.preInit)for("function"==typeof d.preInit&&(d.preInit=[d.preInit]);0<d.preInit.length;)d.preInit.pop()();gb();


    return Module
  }
  );
  })();
  var glslangInit = (() => {
    const initialize = () => {
      return new Promise(resolve => {
        Module({
          locateFile() {
            return wasmuri;
          },
          onRuntimeInitialized() {
            resolve({
              compileGLSLZeroCopy: this.compileGLSLZeroCopy,
              compileGLSL: this.compileGLSL,
            });
          },
        });
      });
    };

    let instance;
    return () => {
      if (!instance) {
        instance = initialize();
      }
      return instance;
    };
  })();

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
  class BufferManager {
      constructor(device) {
          this.device = device;
          this.numUsedBuffers = 0;
          this.numFreeBuffers = 0;
          this.freeBuffers = new Map();
          this.usedBuffers = new Map();
          this.numBytesUsed = 0;
          this.numBytesAllocated = 0;
      }
      acquireBuffer(byteSize, usage) {
          const key = getBufferKey(byteSize, usage);
          if (!this.freeBuffers.has(key)) {
              this.freeBuffers.set(key, []);
          }
          if (!this.usedBuffers.has(key)) {
              this.usedBuffers.set(key, []);
          }
          this.numBytesUsed += byteSize;
          this.numUsedBuffers++;
          if (this.freeBuffers.get(key).length > 0) {
              this.numFreeBuffers--;
              const newBuffer = this.freeBuffers.get(key).shift();
              this.usedBuffers.get(key).push(newBuffer);
              return newBuffer;
          }
          this.numBytesAllocated += byteSize;
          const newBuffer = this.device.createBuffer({ size: byteSize, usage });
          this.usedBuffers.get(key).push(newBuffer);
          return newBuffer;
      }
      releaseBuffer(buffer, byteSize, usage) {
          if (this.freeBuffers == null) {
              return;
          }
          const key = getBufferKey(byteSize, usage);
          if (!this.freeBuffers.has(key)) {
              this.freeBuffers.set(key, []);
          }
          this.freeBuffers.get(key).push(buffer);
          this.numFreeBuffers++;
          this.numUsedBuffers--;
          const bufferList = this.usedBuffers.get(key);
          const bufferIndex = bufferList.indexOf(buffer);
          if (bufferIndex < 0) {
              throw new Error('Cannot release a buffer that was never provided by this ' +
                  'buffer manager');
          }
          bufferList.splice(bufferIndex, 1);
          this.numBytesUsed -= byteSize;
      }
      getNumUsedBuffers() {
          return this.numUsedBuffers;
      }
      getNumFreeBuffers() {
          return this.numFreeBuffers;
      }
      reset() {
          this.freeBuffers = new Map();
          this.usedBuffers = new Map();
          this.numUsedBuffers = 0;
          this.numFreeBuffers = 0;
          this.numBytesUsed = 0;
          this.numBytesAllocated = 0;
      }
      dispose() {
          if (this.freeBuffers == null && this.usedBuffers == null) {
              return;
          }
          this.freeBuffers.forEach((buffers, key) => {
              buffers.forEach(buff => {
                  buff.destroy();
              });
          });
          this.usedBuffers.forEach((buffers, key) => {
              buffers.forEach(buff => {
                  buff.destroy();
              });
          });
          this.freeBuffers = null;
          this.usedBuffers = null;
          this.numUsedBuffers = 0;
          this.numFreeBuffers = 0;
          this.numBytesUsed = 0;
          this.numBytesAllocated = 0;
      }
  }
  function getBufferKey(byteSize, usage) {
      return `${byteSize}_${usage}`;
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
  class ArgMinMaxProgram {
      constructor(inputShape, axis, reduceType) {
          this.variableNames = ['x'];
          this.uniforms = 'int axis;';
          const axes = [axis];
          tf.backend_util.assertAxesAreInnerMostDims('arg' + reduceType.charAt(0).toUpperCase() + reduceType.slice(1), axes, inputShape.length);
          const op = reduceType === 'min' ? '<' : '>';
          // |outShape| is the shape with the removed axis
          // |reduceShape| is the shape we are reducing. i.e. [ inputShape[axis] ]
          const [outputShape, reduceShape] = tf.backend_util.computeOutAndReduceShapes(inputShape, axes);
          this.outputShape = outputShape.length === 0 ? [1] : outputShape;
          // Length of the axis we're reducing on.
          const reduceSize = tf.util.sizeFromShape(reduceShape);
          // The number of comparisons each thread will do
          const reductionFactor = 2;
          const xMaxThreads = 1024; // gl_MaxComputeWorkGroupSize
          const xThreads = Math.min(Math.ceil(reduceSize / reductionFactor), xMaxThreads);
          this.workGroupSize = [xThreads, 1, 1];
          this.dispatchLayout = { x: [], y: this.outputShape.map((d, i) => i) };
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape);
          // When xThreads > 1, each thread reduces Length / xThreads values.
          // Thes results are stored in shared memory and iteratively reduced.
          const reduceInSharedMemory = xThreads > 1;
          const sharedMemorySnippet = `
      shared int xBestIndices[WorkGroupSize];
      shared float xBestValues[WorkGroupSize];
    `;
          const sharedMemoryReduceSnippet = `
      xBestIndices[gl_LocalInvocationID.x] = bestIndex;
      xBestValues[gl_LocalInvocationID.x] = bestValue;

      int currentSize = WorkGroupSize;
      while (currentSize > 1) {
        barrier();

        for (int w = 0; w < ${reductionFactor}; ++w) {
          int i = int(gl_LocalInvocationID.x) * ${reductionFactor} + w;
          if (i < currentSize) {
            int candidateIndex = xBestIndices[i];
            float candidate = xBestValues[i];
            if (candidate ${op} bestValue && !isnan(candidate)) {
              bestValue = candidate;
              bestIndex = candidateIndex;
            }
          }
        }

        xBestIndices[gl_LocalInvocationID.x] = bestIndex;
        xBestValues[gl_LocalInvocationID.x] = bestValue;

        currentSize = DIV_CEIL(currentSize, ${reductionFactor});
      }

      if (gl_LocalInvocationID.x == 0) {
        setOutput(flatOutputIndex, int(bestIndex));
      }
    `;
          const outputCoordsType = getCoordsDataType(this.outputShape.length);
          const indexOutputCoords = (outputCoords, index) => {
              if (this.outputShape.length === 1) {
                  return outputCoords;
              }
              else {
                  return `${outputCoords}[${index}]`;
              }
          };
          const indexInputShape = (index) => {
              if (inputShape.length === 1) {
                  return `${getShapeCoords(inputShape)}`;
              }
              else {
                  return `${getShapeCoords(inputShape)}[${index}]`;
              }
          };
          this.userCode = `
      #define DIV_CEIL(x, y) (((x) - 1) / (y) + 1)

      const int WorkGroupSize = int(gl_WorkGroupSize.x);

      ${reduceInSharedMemory ? sharedMemorySnippet : ''}

      // In order to get a flattened index into the input tensor, we need to
      // add back the index along the reduced dimension to |outputCoords|.
      // This function outputs the offset to the first value along
      // |axis| and the stride to get the next value of the input along |axis|.
      ivec2 getInputCoordInfo() {
        const ${outputCoordsType} outputCoords = getOutputCoords();
        int i = ${this.outputShape.length - 1};

        int stride = 1;
        int inputStride = 1;
        int offset = 0;

        for (int r = 1; r <= ${inputShape.length}; ++r) {
          int length = ${indexInputShape(`${inputShape.length} - r`)};
          if (${inputShape.length} - r == axis) {
            inputStride = stride;
          } else {
            offset += ${indexOutputCoords('outputCoords', 'i--')} * stride;
          }
          stride *= length;
        }

        return ivec2(offset, inputStride);
      }

      int getInputIndex(ivec2 coordInfo, int index) {
        return coordInfo[0] + coordInfo[1] * index;
      }

      void main() {
        const ivec2 coordInfo = getInputCoordInfo();

        int bestIndex = 0;
        float bestValue = x[getInputIndex(coordInfo, bestIndex)];

        const int Length = ${indexInputShape('axis')};
        const int WorkPerThread = DIV_CEIL(Length, WorkGroupSize);

        for (int w = 0; w < WorkPerThread; ++w) {
          int i = int(gl_GlobalInvocationID.x) * WorkPerThread + w;
          if (i < Length) {
            float candidate = x[getInputIndex(coordInfo, i)];
            if (candidate ${op} bestValue && !isnan(candidate)) {
              bestValue = candidate;
              bestIndex = i;
            }
          }
        }

        const int flatOutputIndex = int(gl_GlobalInvocationID.y);
        ${reduceInSharedMemory ? sharedMemoryReduceSnippet :
            'setOutput(flatOutputIndex, int(bestIndex));'}
      }
    `;
          this.shaderKey = `ArgMinMax${op}${reduceInSharedMemory}`;
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
  class ClipProgram {
      constructor(outputShape, minVal, maxVal) {
          this.variableNames = ['A'];
          this.workPerThread = 1;
          this.workGroupSize = [64, 1, 1];
          this.outputShape = outputShape;
          const size = tf.util.sizeFromShape(this.outputShape);
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          const type = getCoordsDataType(this.outputShape.length);
          this.userCode = `
      void main() {
        int index = int(gl_GlobalInvocationID.x);
        for(int i = 0; i < ${this.workPerThread}; i++) {
          int flatIndex = index * ${this.workPerThread} + i;
          if(flatIndex < ${size}) {
            ${type} coords = getCoordsFromFlatIndex(flatIndex);

            float value = getAAtOutCoords(coords);
            if (isnan(value)) {
              setOutput(flatIndex, value);
              return;
            }

            setOutput(flatIndex, clamp(value, ${minVal}, ${maxVal}));
          }
        }
      }
    `;
          this.shaderKey = `clip${size}${type}`;
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
  class ConcatProgram {
      constructor(shapes) {
          this.workPerThread = 4;
          this.workGroupSize = [64, 1, 1];
          this.outputShape =
              tf.backend_util.computeOutShape(shapes, 1 /* axis */);
          this.variableNames = shapes.map((_, i) => `T${i}`);
          const size = tf.util.sizeFromShape(this.outputShape);
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          const offsets = new Array(shapes.length - 1);
          offsets[0] = shapes[0][1];
          for (let i = 1; i < offsets.length; i++) {
              offsets[i] = offsets[i - 1] + shapes[i][1];
          }
          const snippets = [
              `if (yC < ${offsets[0]}) setOutput(coords.x, coords.y, getT0(yR, yC));`
          ];
          for (let i = 1; i < offsets.length; i++) {
              const shift = offsets[i - 1];
              snippets.push(`else if (yC < ${offsets[i]}) ` +
                  `setOutput(coords.x, coords.y, getT${i}(yR, yC-${shift}));`);
          }
          const lastIndex = offsets.length;
          const lastShift = offsets[offsets.length - 1];
          snippets.push(`else setOutput(coords.x, coords.y, getT${lastIndex}(yR, yC-${lastShift}));`);
          this.userCode = `
      void main() {
        int index = int(gl_GlobalInvocationID.x);

        for(int i = 0; i < ${this.workPerThread}; i++) {
          int flatIndex = index * ${this.workPerThread} + i;
          if(flatIndex < ${size}) {
            ivec2 coords = getCoordsFromFlatIndex(flatIndex);
            int yR = coords.x;
            int yC = coords.y;

            ${snippets.join('\n        ')}
          }
        }
      }
    `;
          this.shaderKey = `concat${size}${offsets.join(',')}`;
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
  const matMulHeader = `
  float mm_readA(int row, int col);
  float mm_readB(int row, int col);
  void mm_write(int row, int col, float value);
  void mm_matMul(int dimAOuter, int dimInner, int dimBOuter);`;
  function makeMatMulSource() {
      return `
    ${matMulHeader}

    const int MatTileSize = int(gl_WorkGroupSize.x);  // .x == .y
    shared float mm_Asub[MatTileSize][MatTileSize];
    shared float mm_Bsub[MatTileSize][MatTileSize];

    void mm_matMul(int dimAOuter, int dimInner, int dimBOuter) {
        int localRow = int(gl_LocalInvocationID.y);  // 0..MatTileSize
        int localCol = int(gl_LocalInvocationID.x);  // 0..MatTileSize
        int globalRow = int(gl_GlobalInvocationID.y);  // AOuter
        int globalCol = int(gl_GlobalInvocationID.x);  // Inner

        float acc = 0.0;

        int numTiles = (dimInner - 1) / MatTileSize + 1;

        for (int t = 0; t < numTiles; t++) {
          // Load one tile of A and B into local memory
          int tiledACol = MatTileSize * t + localCol;
          int tiledBRow = MatTileSize * t + localRow;
          mm_Asub[localRow][localCol] = mm_readA(globalRow, tiledACol);
          mm_Bsub[localRow][localCol] = mm_readB(tiledBRow, globalCol);

          // Synchronise to make sure the tile is loaded
          barrier();

          for (int k = 0; k < MatTileSize; k++) {
            acc += mm_Asub[localRow][k] * mm_Bsub[k][localCol];
          }

          // Synchronise before loading the next tile
          barrier();
        }

        if (globalCol < dimBOuter && globalRow < dimAOuter) {
          mm_write(globalRow, globalCol, acc);
        }
      }
  `;
  }
  class MatMulProgram {
      constructor(aShape, outputShape, transposeA = false, transposeB = false) {
          this.variableNames = ['A', 'B'];
          this.workGroupSize = [16, 16, 1]; // Must be square.
          const dimInner = transposeA ? aShape[1] : aShape[2];
          const dimBOuter = outputShape[2];
          const bShape = transposeB ? [outputShape[0], dimBOuter, dimInner] :
              [outputShape[0], dimInner, dimBOuter];
          this.outputShape = outputShape;
          this.dispatchLayout = { x: [2], y: [1], z: [0] };
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize);
          const fitA = tilesFitEvenlyIntoShape(this.workGroupSize.slice(0, 2), aShape.slice(1));
          let sampleA;
          if (transposeA === false) {
              sampleA = fitA ?
                  `A[row * dimInner + col]` :
                  `coordsInBounds(ivec2(row, col), ivec2(dimAOuter, dimInner)) ?
                A[row * dimInner + col] : 0`;
          }
          else {
              sampleA = fitA ?
                  `A[col * dimAOuter + row]` :
                  `coordsInBounds(ivec2(row, col), ivec2(dimAOuter, dimInner)) ?
                A[col * dimAOuter + row] : 0`;
          }
          const fitB = tilesFitEvenlyIntoShape(this.workGroupSize.slice(0, 2), bShape.slice(1));
          let sampleB;
          if (transposeB === false) {
              sampleB = fitB ?
                  `B[row * dimBOuter + col]` :
                  `coordsInBounds(ivec2(row, col), ivec2(dimInner, dimBOuter)) ?
                B[row * dimBOuter + col] : 0`;
          }
          else {
              sampleB = fitB ?
                  `B[col * dimInner + row]` :
                  `coordsInBounds(ivec2(row, col), ivec2(dimInner, dimBOuter)) ?
                B[col * dimInner + row] : 0`;
          }
          this.userCode = `
      int dimAOuter = ${transposeA === true ? `aShape[2]` : `aShape[1]`};
      int dimInner = ${transposeA === true ? `aShape[1]` : `aShape[2]`};
      int dimBOuter = ${transposeB === true ? `bShape[1]` : `bShape[2]`};

      ${makeMatMulSource()}

      float mm_readA(int row, int col) {
        return ${sampleA};
      }

      float mm_readB(int row, int col) {
        return ${sampleB};
      }

      void mm_write(int row, int col, float value) {
        setOutput(row * dimBOuter + col, value);
      }

      void main() {
        mm_matMul(dimAOuter, dimInner, dimBOuter);
      }
    `;
          this.shaderKey = `matmul${fitA}${fitB}${transposeA}${transposeB}`;
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
  function makeMatMulPackedSource(workPerThread) {
      return `
    ${matMulHeader}

    const int RowPerThread = ${workPerThread[1]};
    const int ColPerThread = ${workPerThread[0]};
    const int TileAOuter = int(gl_WorkGroupSize.y) * RowPerThread;
    const int TileBOuter = int(gl_WorkGroupSize.x) * ColPerThread;
    const int TileInner = TileAOuter > TileBOuter ? TileAOuter : TileBOuter;

    shared float mm_Asub[TileAOuter][TileInner];
    shared float mm_Bsub[TileInner][TileBOuter];

    void mm_matMul(int dimAOuter, int dimInner, int dimBOuter) {
      int tileRow = int(gl_LocalInvocationID.y) * RowPerThread;
      int tileCol = int(gl_LocalInvocationID.x) * ColPerThread;

      int globalRow = int(gl_GlobalInvocationID.y) * RowPerThread;
      int globalCol = int(gl_GlobalInvocationID.x) * ColPerThread;

      int numTiles = (dimInner - 1) / TileInner + 1;

      float acc[RowPerThread][ColPerThread];
      float ACached;
      float BCached[ColPerThread];

      // Without this initialization strange values show up in acc.
      for (int innerRow = 0; innerRow < RowPerThread; innerRow++) {
        for (int innerCol = 0; innerCol < ColPerThread; innerCol++) {
          acc[innerRow][innerCol] = 0.0;
        }
      }

      const int ColPerThreadA = TileInner / int(gl_WorkGroupSize.x);
      int tileColA = int(gl_LocalInvocationID.x) * ColPerThreadA;
      const int RowPerThreadB = TileInner / int(gl_WorkGroupSize.y);
      int tileRowB = int(gl_LocalInvocationID.y) * RowPerThreadB;

      // Loop over shared dimension.
      for (int t = 0; t < numTiles; t++) {
        // Load one tile of A into local memory.
        for (int innerRow = 0; innerRow < RowPerThread; innerRow++) {
          for (int innerCol = 0; innerCol < ColPerThreadA; innerCol++) {
            int inputRow = tileRow + innerRow;
            int inputCol = tileColA + innerCol;

            mm_Asub[inputRow][inputCol] = mm_readA(
                globalRow + innerRow,
                t * TileInner + inputCol);
          }
        }
        // Load one tile of B into local memory.
        for (int innerRow = 0; innerRow < RowPerThreadB; innerRow++) {
          for (int innerCol = 0; innerCol < ColPerThread; innerCol++) {
            int inputRow = tileRowB + innerRow;
            int inputCol = tileCol + innerCol;

            mm_Bsub[inputRow][inputCol] = mm_readB(
              t * TileInner + inputRow,
              globalCol + innerCol);;
          }
        }

        barrier();

        // Compute acc values for a single thread.
        for (int k = 0; k < TileInner; k++) {
          for (int inner = 0; inner < ColPerThread; inner++) {
            BCached[inner] = mm_Bsub[k][tileCol + inner];
          }

          for (int innerRow = 0; innerRow < RowPerThread; innerRow++) {
            ACached = mm_Asub[tileRow + innerRow][k];
            for (int innerCol = 0; innerCol < ColPerThread; innerCol++) {
              acc[innerRow][innerCol] += ACached * BCached[innerCol];
            }
          }
        }

        barrier();
      }

      for (int innerRow = 0; innerRow < RowPerThread; innerRow++) {
        for (int innerCol = 0; innerCol < ColPerThread; innerCol++) {

          if ((globalCol + innerCol) < dimBOuter &&
              (globalRow + innerRow) < dimAOuter) {
            mm_write(globalRow + innerRow,
                     globalCol + innerCol,
                     acc[innerRow][innerCol]);
          }
        }
      }
    }
  `;
  }
  class MatMulPackedProgram {
      constructor(aShape, outputShape, workPerThread, transposeA = false, transposeB = false) {
          this.variableNames = ['A', 'B'];
          this.workGroupSize = [16, 16, 1];
          const dimInner = transposeA ? aShape[1] : aShape[2];
          const dimBOuter = outputShape[2];
          const bShape = transposeB ? [outputShape[0], dimBOuter, dimInner] :
              [outputShape[0], dimInner, dimBOuter];
          this.outputShape = outputShape;
          this.dispatchLayout = { x: [2], y: [1], z: [0] };
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [workPerThread, workPerThread, 1]);
          // If dispaching number is one, it means only one work group is running.
          // For modern GPUs, it supports multiple work groups running in parallel.
          // So there may be some idle hardware threads.
          // In this case, we prefer to reduce the work per thread and improve the
          // thread utilization
          if (tf.util.arraysEqual(this.dispatch, [1, 1, 1])) {
              workPerThread = 1;
              this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [workPerThread, workPerThread, 1]);
          }
          this.workPerThread = workPerThread;
          const tileAOuter = this.workGroupSize[1] * workPerThread;
          const tileBOuter = this.workGroupSize[0] * workPerThread;
          const tileInner = tileAOuter > tileBOuter ? tileAOuter : tileBOuter;
          tf.util.assert(tileInner % this.workGroupSize[0] === 0 &&
              tileInner % this.workGroupSize[1] === 0, () => `tileInner must be multiple of workgroupsize.x ` +
              `and workgroupsize.y`);
          const tileSizeA = [tileAOuter, tileInner];
          const tileSizeB = [tileInner, tileBOuter];
          const fitA = tilesFitEvenlyIntoShape(tileSizeA, aShape.slice(1));
          let sampleA;
          if (transposeA === false) {
              sampleA = fitA ?
                  `A[row * dimInner + col]` :
                  `coordsInBounds(ivec2(row, col), ivec2(dimAOuter, dimInner)) ?
            A[row * dimInner + col] : 0`;
          }
          else {
              sampleA = fitA ?
                  `A[col * dimAOuter + row]` :
                  `coordsInBounds(ivec2(row, col), ivec2(dimAOuter, dimInner)) ?
            A[col * dimAOuter + row] : 0`;
          }
          const fitB = tilesFitEvenlyIntoShape(tileSizeB, bShape.slice(1));
          let sampleB;
          if (transposeB === false) {
              sampleB = fitB ?
                  `B[row * dimBOuter + col]` :
                  `coordsInBounds(ivec2(row, col), ivec2(dimInner, dimBOuter)) ?
            B[row * dimBOuter + col] : 0`;
          }
          else {
              sampleB = fitB ?
                  `B[col * dimInner + row]` :
                  `coordsInBounds(ivec2(row, col), ivec2(dimInner, dimBOuter)) ?
            B[col * dimInner + row] : 0`;
          }
          this.userCode = `
      int dimAOuter = ${transposeA === true ? `${aShape[2]}` : `${aShape[1]}`};
      int dimInner = ${transposeA === true ? `${aShape[1]}` : `${aShape[2]}`};
      int dimBOuter = ${transposeB === true ? `${bShape[1]}` : `${bShape[2]}`};

      ${makeMatMulPackedSource([
            workPerThread, workPerThread, 1
        ])}
      float mm_readA(int row, int col) {
        return ${sampleA};
      }

      float mm_readB(int row, int col) {
        return ${sampleB};
      }

      void mm_write(int row, int col, float value) {
        setOutput(row * dimBOuter + col, value);
      }

      void main() {
        mm_matMul(dimAOuter, dimInner, dimBOuter);
      }
    `;
          this.shaderKey = `matmulpacked${this.workPerThread}${fitA}${fitB}${transposeA}${transposeB}`;
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
  class Conv2DMMProgram {
      constructor(convInfo, workPerThread, addBias = false, activation = null, hasPreluActivationWeights = false) {
          this.variableNames = ['x', 'W'];
          this.uniforms = 'ivec2 filterDims, pad, stride, dilation;';
          this.outputShape = convInfo.outShape;
          tf.util.assert(convInfo.dataFormat === 'channelsLast', () => 'TODO: NCHW is unimplemented');
          this.dispatchLayout = { x: [3], y: [1, 2], z: [0] };
          this.workGroupSize =
              computeWorkGroupSizeForConv2d(this.dispatchLayout, this.outputShape);
          let elementsPerThread;
          let matMulSource;
          if (workPerThread === 0) {
              elementsPerThread = [1, 1, 1];
              matMulSource = makeMatMulSource();
          }
          else {
              elementsPerThread =
                  computeWorkPerThreadForConv2d(this.dispatchLayout, this.outputShape);
              matMulSource = makeMatMulPackedSource(elementsPerThread);
          }
          const tileAOuter = this.workGroupSize[1] * elementsPerThread[1];
          const tileBOuter = this.workGroupSize[0] * elementsPerThread[0];
          const tileInner = tileAOuter > tileBOuter ? tileAOuter : tileBOuter;
          tf.util.assert(tileInner % this.workGroupSize[0] === 0 &&
              tileInner % this.workGroupSize[1] === 0, () => 
          // tslint:disable-next-line: max-line-length
          'tileInner must be multiple of workgroupsize.x and workgroupsize.y');
          const tileSizeA = [tileAOuter, tileInner];
          const tileSizeB = [tileInner, tileBOuter];
          const dimAOuter = this.outputShape[1] * this.outputShape[2];
          const dimBOuter = this.outputShape[3];
          const dimInner = convInfo.filterHeight * convInfo.filterWidth * convInfo.inChannels;
          const fitA = tilesFitEvenlyIntoShape(tileSizeA, [dimAOuter, dimInner]);
          const sampleA = fitA ?
              `x[getFlatIndex(coord, ${getShapeCoords(convInfo.inShape)})]` :
              `coordsInBounds(coord, ${getShapeCoords(convInfo.inShape)}) ? x[getFlatIndex(coord, ${getShapeCoords(convInfo.inShape)})] : 0`;
          const fitB = tilesFitEvenlyIntoShape(tileSizeB, [dimInner, dimBOuter]);
          const sampleB = fitB ?
              `W[row * dimBOuter + col]` :
              `coordsInBounds(ivec2(row, col), ivec2(dimInner, dimBOuter)) ?
        W[row * dimBOuter + col] : 0`;
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, elementsPerThread);
          let activationSnippet = '', applyActivationSnippet = '';
          if (activation) {
              if (hasPreluActivationWeights) {
                  activationSnippet = `float activation(float a, ivec4 outCoord) {
              float b = getPreluActivationWeightsAtOutCoords(outCoord);
              ${activation}
            }`;
              }
              else {
                  activationSnippet = `
              float activation(float a, ivec4 outCoord) {
                ${activation}
              }
            `;
              }
              applyActivationSnippet = `value = activation(value, outCoord);`;
          }
          const addBiasSnippet = addBias ? 'ivec4 coords = getOutputCoords(); ' +
              'value += getBiasAtOutCoords(outCoord);' :
              '';
          if (addBias) {
              this.variableNames.push('bias');
          }
          if (hasPreluActivationWeights) {
              this.variableNames.push('preluActivationWeights');
          }
          this.userCode = `
        ${activationSnippet}
        ${matMulSource}

        int batch;
        int dimAOuter = ${this.outputShape[1]} * ${this.outputShape[2]};
        int dimBOuter = ${this.outputShape[3]};
        int dimInner = filterDims[0] * filterDims[1] * ${convInfo.inShape[3]};
        float mm_readA(int row, int col) {
          int r = int(row), c = int(col);
          int outRow = r / ${this.outputShape[2]};
          int outCol = r % ${this.outputShape[2]};

          int WRow = c / (filterDims[1] * ${convInfo.inShape[3]});
          int WCol = (c / ${convInfo.inShape[3]}) % filterDims[1];

          ivec4 coord = ivec4(
              batch,
              outRow * stride[0] + dilation[0] * WRow - pad[0],
              outCol * stride[1] + dilation[1] * WCol - pad[1],
              c % ${convInfo.inShape[3]});
          return ${sampleA};
        }

        float mm_readB(int row, int col) {
          return ${sampleB};
        }

        void mm_write(int row, int col, float value) {
          ivec4 outCoord = ivec4(
              batch,
              row / ${this.outputShape[2]},
              row % ${this.outputShape[2]},
              col);
          ${addBiasSnippet}
          ${applyActivationSnippet}
          result[getFlatIndex(outCoord, ${getShapeCoords(this.outputShape)})] = value;
        }

        void main() {
          batch = int(gl_GlobalInvocationID.z);

          mm_matMul(dimAOuter, dimInner, dimBOuter);
        }
      `;
          this.shaderKey = `conv2dmm'${elementsPerThread.join('')}${fitA}${fitB}${addBiasSnippet}${activationSnippet}`;
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
  class Conv2DNaiveProgram {
      constructor(convInfo, addBias = false, activation = null, hasPreluActivationWeights = false) {
          this.variableNames = ['x', 'W'];
          this.uniforms = 'ivec2 filterDims, pad, stride, dilation;';
          this.workGroupSize = [4, 8, 4];
          this.outputShape = convInfo.outShape;
          this.dispatchLayout = { x: [2], y: [1], z: [0, 3] };
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize);
          tf.util.assert(convInfo.dataFormat === 'channelsLast', () => 'TODO: NCHW is unimplemented');
          let activationSnippet = '', applyActivationSnippet = '';
          if (activation) {
              if (hasPreluActivationWeights) {
                  activationSnippet = `float activation(float a) {
                  float b = getPreluActivationWeightsAtOutCoords();
                  ${activation}
                }`;
              }
              else {
                  activationSnippet = `
                  float activation(float a) {
                    ${activation}
                  }
                `;
              }
              applyActivationSnippet = `value = activation(value);`;
          }
          const addBiasSnippet = addBias ? 'value += getBiasAtOutCoords();' : '';
          if (addBias) {
              this.variableNames.push('bias');
          }
          if (hasPreluActivationWeights) {
              this.variableNames.push('preluActivationWeights');
          }
          this.userCode = `
      ${activationSnippet}
      float readInp(int batch, int row, int col, int chan) {
        ivec4 coord = ivec4(batch, row, col, chan);
        return coordsInBounds(coord, xShape) ?
          getX(batch, row, col, chan) : 0;
      }

      float readFilt(int row, int col, int xChannel, int outChannel) {
        ivec4 coord = ivec4(row, col, xChannel, outChannel);
        return coordsInBounds(coord, wShape) ?
          getW(row, col, xChannel, outChannel) : 0;
      }

      void writeResult(int batch, int row, int col, int chan, float value) {
        ivec4 coord = ivec4(batch, row, col, chan);
        if (coordsInBounds(coord, outShape)) {
          ${addBiasSnippet}
          ${applyActivationSnippet}
          setOutput(batch, row, col, chan, value);
        }
      }

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int outChannel = coords[3];

        float acc = 0.0;

        for (int row = 0; row < filterDims[0]; ++row) {
          for (int col = 0; col < filterDims[1]; ++col) {
            for (int xChannel = 0; xChannel < xShape[3]; ++xChannel) {
              float v = readInp(batch,
                  pad[0] + coords[1] * stride[0] + dilation[0] * row,
                  pad[1] + coords[2] * stride[1] + dilation[1] * col,
                  xChannel);
              float f = readFilt(row, col, xChannel, outChannel);
              acc += v * f;
            }
          }
        }

        writeResult(batch, coords[1], coords[2], outChannel, acc);
      }
    `;
          this.shaderKey = 'conv2dnaive';
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
  class CropAndResizeProgram {
      constructor(imageShape, boxShape, cropSize, method, extrapolationValue) {
          this.variableNames = ['Image', 'Boxes', 'BoxInd'];
          this.workGroupSize = [4, 4, 4];
          const [batch, imageHeight, imageWidth, depth] = imageShape;
          const [numBoxes,] = boxShape;
          const [cropHeight, cropWidth] = cropSize;
          this.outputShape = [numBoxes, cropHeight, cropWidth, depth];
          const methodId = method === 'bilinear' ? 1 : 0;
          this.dispatchLayout = { x: [1, 2], y: [0], z: [3] };
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize);
          const [inputHeightFloat, inputWidthFloat] = [`${imageHeight - 1}.0`, `${imageWidth - 1}.0`];
          const [heightRatio, heightScale, inY] = cropHeight > 1 ?
              [
                  `${(imageHeight - 1) / (cropHeight - 1)}`,
                  '(y2-y1) * height_ratio',
                  `y1*${inputHeightFloat} + float(y)*(height_scale)`,
              ] :
              [
                  '0.0',
                  '0.0',
                  `0.5 * (y1+y2) * ${inputHeightFloat}`,
              ];
          const [widthRatio, widthScale, inX] = cropWidth > 1 ?
              [
                  `${(imageWidth - 1) / (cropWidth - 1)}`,
                  '(x2-x1) * width_ratio',
                  `x1*${inputWidthFloat} + float(x)*(width_scale)`,
              ] :
              [
                  '0.0',
                  '0.0',
                  `0.5 * (x1+x2) * ${inputWidthFloat}`,
              ];
          // Reference implementation
          // tslint:disable-next-line:max-line-length
          // https://github.com/tensorflow/tensorflow/blob/master/tensorflow/core/kernels/crop_and_resize_op_gpu.cu.cc
          this.userCode = `
      const float height_ratio = float(${heightRatio});
      const float width_ratio = float(${widthRatio});
      void writeResult(ivec4 coords,float value) {
        if (coordsInBounds(coords, ${getShapeCoords(this.outputShape)})) {
          setOutput(coords[0], coords[1], coords[2], coords[3], value);
        }
      }
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int y = coords[1];
        int x = coords[2];
        int d = coords[3];
        // get box vals
        float y1 = getBoxes(b,0);
        float x1 = getBoxes(b,1);
        float y2 = getBoxes(b,2);
        float x2 = getBoxes(b,3);
        // get image in batch index
        int bInd = int(round(getBoxInd(b)));
        if(bInd < 0 || bInd >= ${batch}) {
          return;
        }
        float height_scale = ${heightScale};
        float width_scale = ${widthScale};
        float in_y = ${inY};
        if( in_y < 0.0 || in_y > ${inputHeightFloat} ) {
          writeResult(coords,float(${extrapolationValue}));
          return;
        }
        float in_x = ${inX};
        if( in_x < 0.0 || in_x > ${inputWidthFloat} ) {
          writeResult(coords,float(${extrapolationValue}));
          return;
        }
        vec2 sourceFracIndexCR = vec2(in_x,in_y);
        if(${methodId} == 1) {
          // Compute the four integer indices.
          ivec2 sourceFloorCR = ivec2(sourceFracIndexCR);
          ivec2 sourceCeilCR = ivec2(ceil(sourceFracIndexCR));
          float topLeft = getImage(bInd, sourceFloorCR.y, sourceFloorCR.x, d);
          float bottomLeft = getImage(bInd, sourceCeilCR.y, sourceFloorCR.x, d);
          float topRight = getImage(bInd, sourceFloorCR.y, sourceCeilCR.x, d);
          float bottomRight = getImage(bInd, sourceCeilCR.y, sourceCeilCR.x, d);
          vec2 fracCR = sourceFracIndexCR - vec2(sourceFloorCR);
          float top = topLeft + (topRight - topLeft) * fracCR.x;
          float bottom = bottomLeft + (bottomRight - bottomLeft) * fracCR.x;
          float newValue = top + (bottom - top) * fracCR.y;
          writeResult(coords,newValue);
        } else {
          // Compute the coordinators of nearest neighbor point.
          ivec2 sourceNearestCR = ivec2(floor(
            sourceFracIndexCR + vec2(0.5,0.5)));
          float newValue = getImage(
            bInd, sourceNearestCR.y, sourceNearestCR.x, d);
          writeResult(coords,newValue);
        }
      }
    `;
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
  class DepthwiseConv2DProgram {
      constructor(convInfo) {
          this.variableNames = ['x', 'W'];
          this.uniforms = 'ivec2 filterDims, pad, stride, dilation, inDims;';
          // This is an experimental value.
          this.workGroupSize = [256, 1, 1];
          this.outputShape = convInfo.outShape;
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize);
          const channelMul = convInfo.outChannels / convInfo.inChannels;
          tf.util.assert(convInfo.dataFormat === 'channelsLast', () => 'TODO: NCHW is unimplemented');
          this.userCode = `
      void writeResult(int batch, int row, int col, int chan, float value) {
        ivec4 coord = ivec4(batch, row, col, chan);
        if (coordsInBounds(coord, ${getShapeCoords(this.outputShape)})) {
          setOutput(batch, row, col, chan, value);
        }
      }

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        ivec2 xRCCorner = coords.yz * stride - pad;
        int d2 = coords[3];
        int d1 = d2 / ${channelMul};
        int q = d2 - d1 * ${channelMul};

        int xRCorner = xRCCorner.x;
        int xCCorner = xRCCorner.y;

        // Convolve x(?, ?, d1) with w(:, :, d1, q) to get y(yR, yC, d2).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;
        // TODO(xing.xu): Flatten the two for loops and vec4 the operations.
        for (int wR = 0; wR < filterDims[0]; wR++) {
          int xR = xRCorner + wR * dilation[0];

          if (xR < 0 || xR >= inDims[0]) {
            continue;
          }

          for (int wC = 0; wC < filterDims[1]; wC++) {
            int xC = xCCorner + wC * dilation[1];

            if (xC < 0 || xC >= inDims[1]) {
              continue;
            }

            float xVal = getX(batch, xR, xC, d1);
            float wVal = getW(wR, wC, d1, q);
            dotProd += xVal * wVal;
          }
        }
        writeResult(batch, coords[1], coords[2], d2, dotProd);
      }
    `;
          this.shaderKey = `depthwise${channelMul}`;
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
  class FillProgram {
      constructor(shape, value) {
          this.variableNames = [];
          this.outputShape = [];
          this.workPerThread = 4;
          this.workGroupSize = [16, 1, 1];
          this.outputShape = shape;
          const size = tf.util.sizeFromShape(this.outputShape);
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          this.userCode = `
      void main() {
        int index = int(gl_GlobalInvocationID.x);
        for (int i = 0; i < ${this.workPerThread}; i++) {
          int flatIndex = index * ${this.workPerThread} + i;
          if (flatIndex < ${size}) {
            setOutput(flatIndex,${value});
          }
        }
      }
    `;
          this.shaderKey = `fill${size}${value}`;
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
  class Im2ColProgram {
      constructor(outputShape, inputShape, convInfo) {
          this.variableNames = ['A'];
          this.workPerThread = 4;
          this.workGroupSize = [64, 1, 1];
          this.outputShape = outputShape;
          this.rank = outputShape.length;
          const size = tf.util.sizeFromShape(this.outputShape);
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          const { filterWidth, inChannels, strideWidth, strideHeight, padInfo, outWidth, dilationWidth, dilationHeight, dataFormat } = convInfo;
          const { left, top } = padInfo;
          const itemsPerBlockRow = inChannels * filterWidth;
          const isChannelsLast = dataFormat === 'channelsLast';
          const rowDim = isChannelsLast ? 0 : 1;
          const colDim = isChannelsLast ? 1 : 2;
          this.userCode = `
      void main() {
        int index = int(gl_GlobalInvocationID.x);

        for(int i=0; i<${this.workPerThread}; i++) {
          int flatIndex = index * ${this.workPerThread} + i;

          ivec2 rc = getCoordsFromFlatIndex(flatIndex);

          if(flatIndex < ${size}) {
            int blockIndex = rc[0];
            int pos = rc[1];

            int offsetY = int(blockIndex / ${outWidth}) * ${strideHeight} -
              ${top};
            int d0 = offsetY + ${dilationHeight} * (pos / ${itemsPerBlockRow});
            float value = 0.0;
            if(d0 < ${inputShape[rowDim]} && d0 >= 0) {
              int offsetX = int(mod(float(blockIndex), ${outWidth}.) *
                ${strideWidth}. - ${left}.);
              int d1 = offsetX + ${dilationWidth} * (int(mod(float(pos),
                ${itemsPerBlockRow}.) / ${inChannels}.));
              int ch = int(mod(float(pos), ${inChannels}.));
              if(d1 < ${inputShape[colDim]} && d1 >= 0) {
                value = getA(d0, d1, ch);
              }
            }
            setOutput(flatIndex, value);
          }
        }
      }
    `;
      }
  }

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
  class MaxPoolWithFilterSizeEqualsOneProgram {
      constructor(convInfo) {
          this.variableNames = ['x'];
          this.uniforms = 'ivec2 pad, stride, dilation, convDims, filterDims;';
          this.workGroupSize = [256, 1, 1];
          this.outputShape = convInfo.outShape;
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize);
          this.userCode = `
      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int d = coords[3];

        if (all(lessThan(coords, ${getShapeCoords(this.outputShape)}))) {
          ivec2 xRCCorner = coords.yz * stride;
          int xRCorner = xRCCorner.x;
          int xCCorner = xRCCorner.y;

          float value = getX(batch, xRCorner, xCCorner, d);
          setOutput(batch, coords[1], coords[2], d, value);
        }
      }
    `;
          this.shaderKey = 'maxpoolv2';
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
  class PadProgram {
      constructor(xShape, paddings, constantValue) {
          this.variableNames = ['x'];
          this.workPerThread = 8;
          this.workGroupSize = [16, 1, 1];
          this.outputShape = paddings.map((p, i) => p[0] /* beforePad */ + xShape[i] + p[1] /* afterPad */);
          const rank = xShape.length;
          const size = tf.util.sizeFromShape(this.outputShape);
          const type = getCoordsDataType(rank);
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          const start = paddings.map(p => p[0]).join(',');
          const end = paddings.map((p, i) => p[0] + xShape[i]).join(',');
          const startValue = rank > 1 ? `${type}(${start})` : `${start}`;
          const endValue = rank > 1 ? `${type}(${end})` : `${end}`;
          const leftPadCondition = rank > 1 ? `any(lessThan(outC, start))` : `outC < start`;
          const rightPadCondition = rank > 1 ? `any(greaterThanEqual(outC, end))` : `outC >= end`;
          const unpackedCoords = rank > 1 ?
              ['coords[0]', 'coords[1]', 'coords[2]', 'coords[3]'].slice(0, rank) :
              'coords';
          this.userCode = `
      ${type} start = ${startValue};
      ${type} end = ${endValue};

      void main() {
        int index = int(gl_GlobalInvocationID.x);

        for (int i = 0; i < ${this.workPerThread}; i++) {
          int flatIndex = index * ${this.workPerThread} + i;

          if (flatIndex < ${size}) {
            ${type} outC = getCoordsFromFlatIndex(flatIndex);

            if (${leftPadCondition} || ${rightPadCondition}) {
              setOutput(flatIndex, ${constantValue});
            } else {
              ${type} coords = outC - start;
              setOutput(flatIndex, getX(${unpackedCoords}));
            }
          }
        }
      }
    `;
          this.shaderKey =
              `pad${startValue}${endValue}${rank}${size}${type}${constantValue}`;
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
  class Pool2DProgram {
      constructor(convInfo, poolType) {
          this.variableNames = ['x'];
          this.uniforms = 'ivec2 pad, stride, dilation, convDims, filterDims;';
          // TODO(jiajia.qin@intel.com): Dynamically choose different workGroupSize and
          // workPerThead for different output shapes.
          this.workGroupSize = [16, 16, 1];
          this.workPerThread = 4;
          this.outputShape = convInfo.outShape;
          this.dispatchLayout = { x: [0, 1, 2], y: [3] };
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [1, this.workPerThread, 1]);
          let updateSnippet = `resultValue[i] = max(value, resultValue[i]);`;
          if (poolType === 'avg') {
              updateSnippet = `resultValue[i] += value; count[i] += 1.0;`;
          }
          let returnValue = `resultValue[i]`;
          if (poolType === 'avg') {
              returnValue = `resultValue[i] / count[i]`;
          }
          this.userCode = `
      float getValue(int batch, int xR, int xC, int d) {
        if (xC < 0 || xC >= convDims.x) {
          return 0.0;
        }
        return getX(batch, xR, xC, d);
      }

      void main() {
        ivec4 coords = getOutputCoords();
        if (all(lessThan(coords, ${getShapeCoords(this.outputShape)}))) {
          int batch = coords[0];
          ivec2 xRCCorner = coords.yz * stride - pad;
          int xRCorner = xRCCorner.x;
          int xCCorner = xRCCorner.y;

          float resultValue[${this.workPerThread}];
          float count[${this.workPerThread}];
          for (int i = 0; i < ${this.workPerThread}; i++)
          {
            resultValue[i] = 0.0;
            count[i] = 0.0;
          }

          for (int wR = 0; wR < filterDims.y; wR += dilation.y) {
            int xR = xRCorner + wR;

            if (xR < 0 || xR >= convDims.y) {
              continue;
            }

            for (int wC = 0; wC < filterDims.x; wC += dilation.x) {
              int xC = xCCorner + wC * dilation.x;
              for (int i = 0; i < ${this.workPerThread}; i++)
              {
                int d = coords[3] * ${this.workPerThread} + i;
                if (d < ${this.outputShape[3]})
                {
                  float value = getValue(batch, xR, xC, d);
                  ${updateSnippet}
                }
                else
                {
                  break;
                }
              }
            }
          }
          for (int i = 0; i < ${this.workPerThread}; i++)
          {
            int d = coords[3] * ${this.workPerThread} + i;
            if (d < ${this.outputShape[3]})
            {
              setOutput(batch, coords[1], coords[2], d, ${returnValue});
            }
            else
            {
              break;
            }
          }
        }
      }
    `;
          this.shaderKey = `pool2d${poolType}${this.workPerThread}`;
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
  class ReduceProgram {
      constructor(reduceInfo, reduceType) {
          this.variableNames = ['x'];
          const inputShape = [reduceInfo.batchSize, reduceInfo.inSize];
          const [outputShape, reduceShape] = tf.backend_util.computeOutAndReduceShapes(inputShape, [1]);
          this.outputShape = outputShape.length === 0 ? [1] : outputShape;
          const reduceSize = tf.util.sizeFromShape(reduceShape);
          const reductionFactor = 2;
          const xMaxThreads = 1024;
          const xThreads = Math.min(Math.ceil(reduceSize / reductionFactor), xMaxThreads);
          this.workGroupSize = [xThreads, 1, 1];
          this.dispatchLayout = { x: [], y: this.outputShape.map((d, i) => i) };
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape);
          const reduceInSharedMemory = xThreads > 1;
          const minmaxOp = `
          if (candidate ${reduceType === 'min' ? '<' : '>'} bestValue
          && !isnan(candidate))
          {  bestValue = candidate; }
      `;
          const sumOp = ' bestValue += candidate; ';
          const op = (reduceType === 'min' || reduceType === 'max') ? minmaxOp : sumOp;
          const sharedMemorySnippet = `
        shared float xBestValues[WorkGroupSize];
      `;
          const sharedMemoryReduceSnippet = `
      xBestValues[gl_LocalInvocationID.x] = bestValue;
      ${reduceType === 'sum' ? 'bestValue=0;' : ' '}
      int currentSize = WorkGroupSize;
      while (currentSize > 1) {
        barrier();
        for (int w = 0; w < ${reductionFactor}; ++w) {
          int i = int(gl_LocalInvocationID.x) * ${reductionFactor} + w;
          if (i < currentSize) {
            float candidate = xBestValues[i];
            ${op}
          }
        }
        xBestValues[gl_LocalInvocationID.x] = bestValue;
        currentSize = DIV_CEIL(currentSize, ${reductionFactor});
        ${reduceType === 'sum' ? 'if(currentSize > 1) bestValue=0;' : ''}
      }
      if (gl_LocalInvocationID.x == 0) {
        setOutput(flatOutputIndex, bestValue);
      }
    `;
          const outputCoordsType = getCoordsDataType(this.outputShape.length);
          this.userCode = `
      #define DIV_CEIL(x, y) (((x) - 1) / (y) + 1)
      const int WorkGroupSize = int(gl_WorkGroupSize.x);
      ${reduceInSharedMemory ? sharedMemorySnippet : ''}
      int getOffset() {
        const ${outputCoordsType} outputCoords = getOutputCoords();
        int offset = ${this.outputShape.length === 1 ?
            'outputCoords' :
            'outputCoords[0]'} * ${getShapeCoords(inputShape)}[1];
        return offset;
      }
      void main() {
        const int offset= getOffset();
        ${reduceType === 'sum' ? 'float bestValue = 0;' :
            'float bestValue = x[offset];'}
        const int Length = ${inputShape.length === 1 ? `${getShapeCoords(inputShape)}` :
            `${getShapeCoords(inputShape)}[1]`};
        const int WorkPerThread = DIV_CEIL(Length, WorkGroupSize);
        for (int w = 0; w < WorkPerThread; ++w) {
          int i = int(gl_GlobalInvocationID.x) * WorkPerThread + w;
          if (i < Length) {
            float candidate = x[offset + i];
            ${(reduceType === 'max' || reduceType === 'min') ? minmaxOp : sumOp}
          }
        }
        const int flatOutputIndex = int(gl_GlobalInvocationID.y);
        ${reduceInSharedMemory ? sharedMemoryReduceSnippet :
            'setOutput(flatOutputIndex, bestValue);'}
      }
    `;
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
  class ResizeBilinearProgram {
      constructor(inputShape, newHeight, newWidth, alignCorners) {
          this.variableNames = ['x'];
          this.workGroupSize = [4, 4, 4];
          this.outputShape = [inputShape[0], newHeight, newWidth, inputShape[3]];
          this.dispatchLayout = { x: [2], y: [1], z: [0, 3] };
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize);
          const adjustHeight = alignCorners && newHeight > 1;
          const adjustWidth = alignCorners && newWidth > 1;
          this.userCode = `
      void main() {
        ivec4 coords = getOutputCoords();
        if (all(lessThan(coords, ${getShapeCoords(this.outputShape)}))) {
          int b = coords[0];
          int d = coords[3];
          ivec2 rc = coords.yz;

          vec2 effectiveInSize = vec2(
            ${adjustHeight ? `${inputShape[1]} - 1.0` : `${inputShape[1]}`},
            ${adjustWidth ? `${inputShape[2]} - 1.0` : `${inputShape[2]}`});

          vec2 effectiveOutSize = vec2(
            ${adjustHeight ? `${this.outputShape[1]} - 1.0` :
            `${this.outputShape[1]}`},
            ${adjustWidth ? `${this.outputShape[2]} - 1.0` :
            `${this.outputShape[2]}`});

          vec2 effectiveInputOverOutputRatioRC =
              effectiveInSize / effectiveOutSize;

          // Fractional source index
          vec2 sourceFracIndexRC = vec2(rc) * effectiveInputOverOutputRatioRC;

          // Compute the four integer indices.
          ivec2 sourceFloorRC = ivec2(sourceFracIndexRC);
          ivec2 sourceCeilRC = ivec2(
            min(vec2(${inputShape[1]}, ${inputShape[2]}) - 1.0, ceil(sourceFracIndexRC)));

          float topLeft = getX(b, sourceFloorRC.x, sourceFloorRC.y, d);
          float bottomLeft = getX(b, sourceCeilRC.x, sourceFloorRC.y, d);
          float topRight = getX(b, sourceFloorRC.x, sourceCeilRC.y, d);
          float bottomRight = getX(b, sourceCeilRC.x, sourceCeilRC.y, d);

          vec2 fracRC = sourceFracIndexRC - vec2(sourceFloorRC);

          float top = topLeft + (topRight - topLeft) * fracRC.y;
          float bottom = bottomLeft + (bottomRight - bottomLeft) * fracRC.y;
          float newValue = top + (bottom - top) * fracRC.x;

          setOutput(b, coords[1], coords[2], d, newValue);
        }
      }
    `;
          this.shaderKey = `resizeblilinear${adjustHeight}${adjustWidth}`;
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
  class SelectProgram {
      constructor(cRank, shape, rank) {
          this.variableNames = ['c', 'a', 'b'];
          this.workPerThread = 4;
          this.workGroupSize = [16, 1, 1];
          this.outputShape = shape;
          const size = tf.util.sizeFromShape(this.outputShape);
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          let cCoords;
          let abCoords;
          if (rank > 4) {
              throw Error(`Where for rank ${rank} is not yet supported`);
          }
          if (rank === 1) {
              abCoords = `resRC`;
              cCoords = `resRC`;
          }
          else {
              const currentCoords = ['resRC.x', 'resRC.y', 'resRC.z', 'resRC.w'];
              const cCoordVars = [];
              const abCoordVars = [];
              for (let i = 0; i < shape.length; i++) {
                  abCoordVars.push(`${currentCoords[i]}`);
                  if (i < cRank) {
                      cCoordVars.push(`${currentCoords[i]}`);
                  }
              }
              cCoords = cCoordVars.join();
              abCoords = abCoordVars.join();
          }
          const dtype = getCoordsDataType(rank);
          this.userCode = `
      void main() {
        int index = int(gl_GlobalInvocationID.x);

        for (int i = 0; i < ${this.workPerThread}; i++) {
          int flatIndex = index * ${this.workPerThread} + i;

          if (flatIndex < ${size}) {
            ${dtype} resRC = getOutputCoords();
            float cVal = getC(${cCoords});
            if (cVal >= 1.0) {
              setOutput(flatIndex,getA(${abCoords}));
            } else {
              setOutput(flatIndex,getB(${abCoords}));
            }
          }
        }
      }
    `;
          this.shaderKey = `select${size}${rank}`;
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
  class SliceProgram {
      constructor(start, destSize) {
          this.variableNames = ['source'];
          this.workPerThread = 1;
          this.workGroupSize = [16, 1, 1];
          this.outputShape = destSize;
          this.rank = destSize.length;
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          const dtype = getCoordsDataType(this.rank);
          const sourceCoords = getCoords(this.rank);
          const coordSum = destSize.map((_, i) => {
              return `sourceLoc.${coords[i]} = ${start[i]} + coords.${coords[i]};`;
          });
          this.userCode = `
      void main() {
        int index = int(gl_GlobalInvocationID.x);
        ${dtype} sourceLoc;
        ${dtype} coords = getOutputCoords();
        ${coordSum.join('\n')}
        setOutput(index, getSource(${sourceCoords}));
      }
    `;
          this.shaderKey = `slice${this.rank}${start.join(',')}`;
      }
  }
  const coords = ['x', 'y', 'z', 'w', 'u', 'v'];
  function getCoords(rank) {
      if (rank === 1) {
          return 'sourceLoc';
      }
      else if (rank <= 6) {
          return coords.slice(0, rank).map(coord => `sourceLoc.${coord}`).join(',');
      }
      else {
          throw Error(`Slicing for rank ${rank} is not yet supported`);
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
  class StridedSliceProgram {
      constructor(begin, strides, destSize) {
          this.variableNames = ['x'];
          // TODO(xing.xu): Increase the workPerThread.
          this.workPerThread = 1;
          this.workGroupSize = [16, 1, 1];
          this.outputShape = destSize;
          const rank = destSize.length;
          const inputDtype = getCoordsDataType(destSize.length);
          const dtype = getCoordsDataType(destSize.length);
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          let newCoords = '';
          if (rank === 1) {
              newCoords = 'coords * strides + begin';
          }
          else {
              let outputAxis = 0;
              newCoords =
                  destSize
                      .map((_, i) => {
                      outputAxis++;
                      return destSize.length === 1 ?
                          `coords * strides[${i}] + begin[${i}]` :
                          `coords[${outputAxis - 1}] * strides[${i}] + begin[${i}]`;
                  })
                      .join(',');
          }
          this.userCode = `
      ${inputDtype} begin = ${inputDtype}(${begin});
      ${inputDtype} strides = ${inputDtype}(${strides});

      void main() {
        ${dtype} coords = getOutputCoords();
        int index = int(gl_GlobalInvocationID.x);
        setOutput(index, getX(${newCoords}));
      }
    `;
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
  class TransposeSharedProgram {
      constructor(aShape, newDim) {
          this.variableNames = ['A'];
          this.workGroupSize = [32, 32, 1];
          const outputShape = new Array(aShape.length);
          for (let i = 0; i < outputShape.length; i++) {
              outputShape[i] = aShape[newDim[i]];
          }
          this.outputShape = outputShape;
          this.rank = outputShape.length;
          this.dispatchLayout = { x: [0], y: [1] };
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [1, 1, 1]);
          this.userCode = `
    const int TILE_DIM = ${this.workGroupSize[0]};
    shared float tile[TILE_DIM][TILE_DIM + 1];
    void main() {
        int index = int(gl_GlobalInvocationID.x);
        int x = int(gl_WorkGroupID.x) * TILE_DIM + int(gl_LocalInvocationID.x);
        int y = int(gl_WorkGroupID.y) * TILE_DIM + int(gl_LocalInvocationID.y);
        int width = ${this.outputShape[0]};
        int height = ${this.outputShape[1]};
        if (x < width && y < height) {
          tile[gl_LocalInvocationID.y][gl_LocalInvocationID.x] =
              A[y * width + x];
        }
        barrier();

        x = int(gl_WorkGroupID.y) * TILE_DIM + int(gl_LocalInvocationID.x);
        y = int(gl_WorkGroupID.x) * TILE_DIM + int(gl_LocalInvocationID.y);
        if (x < height && y < width) {
          setOutput((y * height + x), tile[gl_LocalInvocationID.x]
            [gl_LocalInvocationID.y]);
        }
      }
    `;
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
  class TransposeProgram {
      constructor(aShape, newDim) {
          this.variableNames = ['A'];
          this.workPerThread = 4;
          this.workGroupSize = [64, 1, 1];
          const outputShape = new Array(aShape.length);
          for (let i = 0; i < outputShape.length; i++) {
              outputShape[i] = aShape[newDim[i]];
          }
          this.outputShape = outputShape;
          this.rank = outputShape.length;
          const dtype = getCoordsDataType(this.rank);
          const size = tf.util.sizeFromShape(this.outputShape);
          this.dispatchLayout = flatDispatchLayout(this.outputShape);
          this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape, this.workGroupSize, [this.workPerThread, 1, 1]);
          const switched = getSwitchedCoords(newDim);
          this.userCode = `
      void main() {
        int index = int(gl_GlobalInvocationID.x);

        for(int i = 0; i < ${this.workPerThread}; i++) {
          int flatIndex = index * ${this.workPerThread} + i;
          if(flatIndex < ${size}) {
            ${dtype} resRC = getCoordsFromFlatIndex(flatIndex);
            setOutput(flatIndex, A[getFlatIndex(
              ${dtype}(${switched}), ${getShapeCoords(aShape)})]);
          }
        }
      }
    `;
          this.shaderKey = `tranpose${size}${dtype}${newDim.join(',')}`;
      }
  }
  function getSwitchedCoords(newDim) {
      const rank = newDim.length;
      if (rank > 4) {
          throw Error(`Transpose for rank ${rank} is not yet supported`);
      }
      const switchedCoords = new Array(rank);
      for (let i = 0; i < newDim.length; i++) {
          switchedCoords[newDim[i]] = `resRC[${i}]`;
      }
      return switchedCoords.join();
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
  const makeBindGroup = (device, bindGroupLayout, inputs, output, uniforms) => {
      const bindings = [output, ...inputs];
      if (uniforms) {
          bindings.push(uniforms);
      }
      return device.createBindGroup({
          layout: bindGroupLayout,
          entries: bindings.map((b, i) => ({ binding: i, resource: b.resource })),
      });
  };
  const compileProgram = (glslang, device, program, inputsData, output, uniforms) => {
      const outputData = { dtype: output.dtype, shape: output.shape };
      const source = makeShader(inputsData, outputData, program);
      const result = glslang.compileGLSLZeroCopy(source, 'compute', false);
      if (result.data.length === 0) {
          throw new Error('Shader compilation failed');
      }
      const module = device.createShaderModule({ code: result.data });
      const pipeline = device.createComputePipeline({ computeStage: { module, entryPoint: 'main' } });
      const bindGroupLayout = pipeline.getBindGroupLayout(0);
      result.free();
      return { bindGroupLayout, pipeline };
  };
  function makeShaderKey(program, shapes, types) {
      const key = (program.workGroupSize ? program.workGroupSize.join(',') : '') +
          shapes.join(',') + types.join(',') + program.variableNames.join(',') +
          (program.shaderKey ? program.shaderKey : program.userCode);
      return key;
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
  // Empirically determined constant used to determine size threshold for handing
  // off execution to the CPU.
  const CPU_HANDOFF_SIZE_THRESHOLD = 128;
  const DEFAULT_GPUBUFFER_USAGE = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
  class WebGPUBackend extends tf.KernelBackend {
      constructor(device, glslang) {
          super();
          this.commandQueueOwnedIds = new WeakSet();
          this.tensorDisposalQueue = [];
          this.uniformDisposalQueue = [];
          this.disposed = false;
          this.uploadWaitMs = 0;
          this.downloadWaitMs = 0;
          this.binaryCache = {};
          this.device = device;
          this.queue = device.defaultQueue;
          this.commandQueue = [];
          this.glslang = glslang;
          this.bufferManager = new BufferManager(this.device);
          this.tensorMap = new tf.DataStorage(this, tf.engine());
      }
      floatPrecision() {
          return 32;
      }
      flushDisposalQueue() {
          this.tensorDisposalQueue.forEach(d => {
              this.maybeReleaseBuffer(d);
              this.tensorMap.delete(d);
          });
          this.uniformDisposalQueue.forEach(d => this.bufferManager.releaseBuffer(d.buffer, d.byteSize, d.usage));
          this.tensorDisposalQueue = [];
          this.uniformDisposalQueue = [];
      }
      disposeData(dataId) {
          if (!this.tensorMap.has(dataId)) {
              throw new Error(`Tensor ${dataId} was not registered!`);
          }
          if (this.commandQueueOwnedIds.has(dataId)) {
              this.tensorDisposalQueue.push(dataId);
              return;
          }
          else {
              this.maybeReleaseBuffer(dataId);
          }
          this.tensorMap.delete(dataId);
      }
      memory() {
          return {
              numBytesInGPU: this.bufferManager.numBytesUsed,
              numBytesAllocatedInGPU: this.bufferManager.numBytesAllocated,
              unreliable: false
          };
      }
      getBufferManager() {
          return this.bufferManager;
      }
      acquireBuffer(byteSize, usage = DEFAULT_GPUBUFFER_USAGE) {
          return this.bufferManager.acquireBuffer(byteSize, usage);
      }
      maybeReleaseBuffer(dataId) {
          const info = this.tensorMap.get(dataId);
          if (info != null && info.bufferInfo.buffer != null) {
              this.bufferManager.releaseBuffer(info.bufferInfo.buffer, info.bufferInfo.byteSize, info.bufferInfo.usage);
              info.bufferInfo.buffer = null;
          }
      }
      write(values, shape, dtype) {
          const dataId = {};
          const byteSize = tf.util.sizeFromShape(shape) * GPUBytesPerElement(dtype);
          this.tensorMap.set(dataId, {
              dtype,
              values,
              bufferInfo: { byteSize, usage: DEFAULT_GPUBUFFER_USAGE }
          });
          return dataId;
      }
      move(dataId, values, shape, dtype) {
          const byteSize = tf.util.sizeFromShape(shape) * GPUBytesPerElement(dtype);
          this.tensorMap.set(dataId, {
              dtype,
              values,
              bufferInfo: { byteSize, usage: DEFAULT_GPUBUFFER_USAGE }
          });
      }
      submitQueue() {
          this.queue.submit(this.commandQueue.map(enc => enc.finish()));
          this.commandQueue = [];
          this.commandQueueOwnedIds = new WeakSet();
          this.flushDisposalQueue();
      }
      getBuffer(dataId) {
          this.uploadToGPU(dataId);
          return this.tensorMap.get(dataId).bufferInfo.buffer;
      }
      async getBufferData(info) {
          if (info.values != null) {
              // Data is on the CPU.
              return info.values;
          }
          const staging = this.acquireBuffer(info.bufferInfo.byteSize, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
          const encoder = this.device.createCommandEncoder();
          encoder.copyBufferToBuffer(info.bufferInfo.buffer, 0, staging, 0, info.bufferInfo.byteSize);
          this.commandQueue.push(encoder);
          this.submitQueue();
          await staging.mapAsync(GPUMapMode.READ);
          const values = staging.getMappedRange().slice(0);
          staging.unmap();
          if (staging != null) {
              this.bufferManager.releaseBuffer(staging, info.bufferInfo.byteSize, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
          }
          return values;
      }
      convertAndCacheOnCPU(dataId, data) {
          const info = this.tensorMap.get(dataId);
          this.maybeReleaseBuffer(dataId);
          info.values = data;
          return info.values;
      }
      // TODO: Remove once this is fixed:
      // https://github.com/tensorflow/tfjs/issues/1595
      readSync(dataId) {
          const texData = this.tensorMap.get(dataId);
          const { values } = texData;
          if (values == null) {
              throw new Error('WebGPU readSync is only available for CPU-resident tensors.');
          }
          return values;
      }
      async read(dataId) {
          if (!this.tensorMap.has(dataId)) {
              throw new Error(`Tensor ${dataId} was not registered!`);
          }
          const info = this.tensorMap.get(dataId);
          const data = await this.getBufferData(info);
          const dataAsTypedArray = ArrayBufferToTypedArray(data, info.dtype);
          this.convertAndCacheOnCPU(dataId, dataAsTypedArray);
          return dataAsTypedArray;
      }
      async time(f) {
          const oldActiveTimers = this.activeTimers;
          const newActiveTimers = [];
          let outerMostTime = false;
          if (this.programTimersStack == null) {
              this.programTimersStack = newActiveTimers;
              outerMostTime = true;
          }
          else {
              this.activeTimers.push(newActiveTimers);
          }
          this.activeTimers = newActiveTimers;
          f();
          const flattenedActiveTimerQueries = tf.util.flatten(this.activeTimers.map((d) => d.query))
              .filter(d => d != null);
          const flattenedActiveTimerNames = tf.util.flatten(this.activeTimers.map((d) => d.name))
              .filter(d => d != null);
          this.activeTimers = oldActiveTimers;
          if (outerMostTime) {
              this.programTimersStack = null;
          }
          const kernelMs = await Promise.all(flattenedActiveTimerQueries);
          const res = {
              uploadWaitMs: this.uploadWaitMs,
              downloadWaitMs: this.downloadWaitMs,
              kernelMs: tf.util.sum(kernelMs),
              getExtraProfileInfo: () => kernelMs.map((d, i) => ({ name: flattenedActiveTimerNames[i], ms: d }))
                  .map(d => `${d.name}: ${d.ms}`)
                  .join(', '),
              wallMs: null
          };
          this.uploadWaitMs = 0;
          this.downloadWaitMs = 0;
          return res;
      }
      getAndSavePipeline(key, getBinary) {
          if (!(key in this.binaryCache)) {
              this.binaryCache[key] = getBinary();
          }
          return this.binaryCache[key];
      }
      makeOutputArray(shape, dtype) {
          const dataId = this.write(null /* values */, shape, dtype);
          return tf.engine().makeTensorFromDataId(dataId, shape, dtype, this);
      }
      tensorToBinding(tensor) {
          if (!tensor) {
              return null;
          }
          const tensorData = this.tensorMap.get(tensor.dataId);
          return {
              resource: {
                  offset: 0,
                  size: tensorData.bufferInfo.byteSize,
                  buffer: tensorData.bufferInfo.buffer
              }
          };
      }
      startTimer() {
          return { startMs: tf.util.now(), endMs: 0 };
      }
      endTimer(query) {
          query.endMs = tf.util.now();
          return query;
      }
      async getQueryTime(query) {
          const timerQuery = query;
          return timerQuery.endMs - timerQuery.startMs;
      }
      uploadToGPU(dataId) {
          const info = this.tensorMap.get(dataId);
          if (info.bufferInfo.buffer != null) {
              // Already on the GPU.
              return;
          }
          info.bufferInfo.buffer = this.acquireBuffer(info.bufferInfo.byteSize);
          if (info.values) {
              this.queue.writeBuffer(info.bufferInfo.buffer, 0, info.values);
              info.values = null;
          }
      }
      compileAndRun(program, inputs, output, programUniforms) {
          if (output == null) {
              output = this.makeOutputArray(program.outputShape, inputs[0].dtype);
          }
          let uniformDataLength;
          let uniforms;
          if (program.uniforms) {
              // TODO: handle padding of program-specific uniforms
              const uniformData = new Int32Array(programUniforms);
              uniformDataLength = uniformData.byteLength;
              uniforms = this.makeUniforms(uniformData);
          }
          const inputsData = inputs.map((input, i) => {
              this.uploadToGPU(input.dataId);
              return {
                  // Returning dtype from tensorMap because it reflects dtype
                  // of underlying buffer, rather than abstract dtype.
                  dtype: this.tensorMap.get(input.dataId).dtype,
                  shape: input.shape,
                  name: program.variableNames[i]
              };
          });
          this.uploadToGPU(output.dataId);
          const bufferShapes = inputs.concat(output).map(d => d.shape);
          const bufferTypes = inputsData.map(d => d.dtype).concat(output.dtype);
          const key = makeShaderKey(program, bufferShapes, bufferTypes);
          const { bindGroupLayout, pipeline } = this.getAndSavePipeline(key, () => {
              return compileProgram(this.glslang, this.device, program, inputsData, output);
          });
          const shouldTimeProgram = this.activeTimers != null;
          let query;
          if (shouldTimeProgram) {
              query = this.startTimer();
          }
          // Creating bind groups on the fly should never be a bottleneck.
          const bg = makeBindGroup(this.device, bindGroupLayout, inputs.map(t => this.tensorToBinding(t)), this.tensorToBinding(output), uniforms);
          const encoder = this.device.createCommandEncoder();
          const pass = encoder.beginComputePass();
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bg);
          pass.dispatch(program.dispatch[0], program.dispatch[1], program.dispatch[2]);
          pass.endPass();
          this.commandQueue.push(encoder);
          inputs.forEach(input => {
              this.commandQueueOwnedIds.add(input.dataId);
          });
          this.commandQueueOwnedIds.add(output.dataId);
          if (program.uniforms) {
              const uniformInfo = {
                  byteSize: uniformDataLength,
                  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
                  buffer: uniforms.resource.buffer
              };
              this.uniformDisposalQueue.push(uniformInfo);
          }
          if (tf.env().get('WEBGPU_IMMEDIATE_EXECUTION_ENABLED')) {
              this.submitQueue();
          }
          if (shouldTimeProgram) {
              query = this.endTimer(query);
              this.activeTimers.push({ name: program.constructor.name, query: this.getQueryTime(query) });
          }
          return output;
      }
      makeUniforms(data) {
          const dimensionsBuffer = this.acquireBuffer(data.byteLength, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM);
          this.queue.writeBuffer(dimensionsBuffer, 0, data);
          return {
              resource: { offset: 0, size: data.byteLength, buffer: dimensionsBuffer }
          };
      }
      getCPUBackend() {
          if (!tf.env().getBool('WEBGPU_CPU_FORWARD')) {
              return null;
          }
          if (this.cpuBackend == null) {
              this.cpuBackend = tf.engine().findBackend('cpu');
          }
          return this.cpuBackend;
      }
      shouldExecuteOnCPU(inputs, sizeThreshold = CPU_HANDOFF_SIZE_THRESHOLD) {
          return this.getCPUBackend() != null &&
              inputs.every(input => this.tensorMap.get(input.dataId).bufferInfo.buffer == null &&
                  input.size < sizeThreshold);
      }
      pad(x, paddings, constantValue) {
          const program = new PadProgram(x.shape, paddings, constantValue);
          const output = this.makeOutputArray(program.outputShape, x.dtype);
          return this.compileAndRun(program, [x], output);
      }
      avgPool(x, convInfo) {
          let program;
          if (convInfo.filterHeight === 1 && convInfo.filterWidth === 1) {
              program = new MaxPoolWithFilterSizeEqualsOneProgram(convInfo);
          }
          else {
              program = new Pool2DProgram(convInfo, 'avg');
          }
          const output = this.makeOutputArray(program.outputShape, x.dtype);
          const dimensions = [
              convInfo.padInfo.left, convInfo.padInfo.top,
              convInfo.strideWidth, convInfo.strideHeight,
              convInfo.dilationWidth, convInfo.dilationHeight,
              convInfo.inWidth, convInfo.inHeight,
              convInfo.effectiveFilterWidth,
              convInfo.effectiveFilterHeight // Filter dims.
          ];
          return this.compileAndRun(program, [x], output, dimensions);
      }
      maxPool(x, convInfo) {
          let program;
          if (convInfo.filterHeight === 1 && convInfo.filterWidth === 1) {
              program = new MaxPoolWithFilterSizeEqualsOneProgram(convInfo);
          }
          else {
              program = new Pool2DProgram(convInfo, 'max');
          }
          const output = this.makeOutputArray(program.outputShape, x.dtype);
          const dimensions = [
              convInfo.padInfo.left, convInfo.padInfo.top,
              convInfo.strideWidth, convInfo.strideHeight,
              convInfo.dilationWidth, convInfo.dilationHeight,
              convInfo.inWidth, convInfo.inHeight,
              convInfo.effectiveFilterWidth,
              convInfo.effectiveFilterHeight // Filter dims.
          ];
          return this.compileAndRun(program, [x], output, dimensions);
      }
      binaryOp(a, b, op) {
          const program = getBinaryProgram(op, a.shape, b.shape);
          const dtype = tf.backend_util.upcastType(a.dtype, b.dtype);
          const dataId = this.write(null /*values*/, program.outputShape, dtype);
          const output = tf.engine().makeTensorFromDataId(dataId, program.outputShape, dtype, this);
          return this.compileAndRun(program, [a, b], output);
      }
      add(a, b) {
          if (this.shouldExecuteOnCPU([a, b])) {
              return this.cpuBackend.add(a, b);
          }
          return this.binaryOp(a, b, ADD);
      }
      subtract(a, b) {
          if (this.shouldExecuteOnCPU([a, b])) {
              return this.cpuBackend.subtract(a, b);
          }
          return this.binaryOp(a, b, SUB);
      }
      binaryCompareOp(a, b, op) {
          const program = new BinaryOpProgram(op, a.shape, b.shape);
          const dataId = this.write(null /*values*/, program.outputShape, 'bool');
          const output = tf.engine().makeTensorFromDataId(dataId, program.outputShape, 'bool', this);
          return this.compileAndRun(program, [a, b], output);
      }
      less(a, b) {
          return this.binaryCompareOp(a, b, LESS);
      }
      lessEqual(a, b) {
          return this.binaryCompareOp(a, b, LESS_EQUAL);
      }
      greater(a, b) {
          if (this.shouldExecuteOnCPU([a, b])) {
              return this.cpuBackend.greater(a, b);
          }
          return this.binaryCompareOp(a, b, GREATER);
      }
      greaterEqual(a, b) {
          if (this.shouldExecuteOnCPU([a, b])) {
              return this.cpuBackend.greaterEqual(a, b);
          }
          return this.binaryCompareOp(a, b, GREATER_EQUAL);
      }
      conv2dWithIm2Col(x, filter, convInfo) {
          const { filterWidth, filterHeight, inChannels, outWidth, outHeight, dataFormat } = convInfo;
          const sharedDim = filterWidth * filterHeight * inChannels;
          const numCols = outHeight * outWidth;
          const x2ColShape = [numCols, sharedDim];
          const xSqueezed = x.squeeze([0]);
          const w2Row = filter.reshape([1, sharedDim, -1]);
          const im2ColProgram = new Im2ColProgram(x2ColShape, xSqueezed.shape, convInfo);
          const im2Col = this.compileAndRun(im2ColProgram, [xSqueezed]);
          const im2Col3D = im2Col.reshape([1, x2ColShape[0], x2ColShape[1]]);
          const transposeA = false;
          const transposeB = false;
          const matMulProgram = new MatMulPackedProgram([1, x2ColShape[0], x2ColShape[1]], [1, numCols, convInfo.outChannels], tf.env().get('WEBGPU_MATMUL_WORK_PER_THREAD'), transposeA, transposeB);
          const result = this.compileAndRun(matMulProgram, [im2Col3D, w2Row]);
          const isChannelsLast = dataFormat === 'channelsLast';
          if (isChannelsLast) {
              return result.reshape([1, outHeight, outWidth, convInfo.outChannels]);
          }
          return result.reshape([1, convInfo.outChannels, outHeight, outWidth]);
      }
      conv2dByMatMul(x, filter, convInfo) {
          const xShape = x.shape;
          const isChannelsLast = convInfo.dataFormat === 'channelsLast';
          const transposeA = false;
          const transposeB = false;
          const targetShape = isChannelsLast ? xShape[0] * xShape[1] * xShape[2] :
              xShape[0] * xShape[2] * xShape[3];
          const xReshaped = this.reshape(x, [1, targetShape, convInfo.inChannels]);
          const filterReshaped = this.reshape(filter, [1, convInfo.inChannels, convInfo.outChannels]);
          return this.reshape(this.batchMatMul(xReshaped, filterReshaped, transposeA, transposeB), convInfo.outShape);
      }
      conv2d(x, filter, convInfo) {
          if (convInfo.filterHeight === 1 && convInfo.filterWidth === 1 &&
              convInfo.dilationHeight === 1 && convInfo.dilationWidth === 1 &&
              convInfo.strideHeight === 1 && convInfo.strideWidth === 1 &&
              (convInfo.padInfo.type === 'SAME' ||
                  convInfo.padInfo.type === 'VALID')) {
              return this.conv2dByMatMul(x, filter, convInfo);
          }
          if (tf.env().getBool('WEBGPU_CONV_SEPARATE_IM2COL_SHADER') &&
              x.shape[0] === 1) {
              return this.conv2dWithIm2Col(x, filter, convInfo);
          }
          const dataId = this.write(null /*values*/, convInfo.outShape, x.dtype);
          const output = tf.engine().makeTensorFromDataId(dataId, convInfo.outShape, x.dtype, this);
          let program;
          const workPerThread = tf.env().get('WEBGPU_CONV2D_WORK_PER_THREAD');
          if (workPerThread === -1) {
              // TODO(kainino0x): This may be obsolete, but is kept for reference.
              program = new Conv2DNaiveProgram(convInfo);
          }
          else {
              program = new Conv2DMMProgram(convInfo, workPerThread);
          }
          const pad = [convInfo.padInfo.top, convInfo.padInfo.left];
          const dimensions = [
              convInfo.filterHeight, convInfo.filterWidth, ...pad,
              convInfo.strideHeight, convInfo.strideWidth, convInfo.dilationHeight,
              convInfo.dilationWidth
          ];
          return this.compileAndRun(program, [x, filter], output, dimensions);
      }
      depthwiseConv2D(x, filter, convInfo) {
          const program = new DepthwiseConv2DProgram(convInfo);
          const dimensions = [
              convInfo.filterHeight, convInfo.filterWidth, convInfo.padInfo.top,
              convInfo.padInfo.left, convInfo.strideHeight, convInfo.strideWidth,
              convInfo.dilationHeight, convInfo.dilationWidth, convInfo.inHeight,
              convInfo.inWidth
          ];
          return this.compileAndRun(program, [x, filter], null, dimensions);
      }
      mapActivationToShaderProgram(activation, packed = false) {
          if (activation === 'linear') {
              return LINEAR;
          }
          else if (activation === 'relu') {
              return RELU;
          }
          else if (activation === 'elu') {
              return ELU;
          }
          else if (activation === 'relu6') {
              return RELU6;
          }
          else if (activation === 'prelu') {
              return PRELU;
          }
          throw new Error(`Activation ${activation} has not been implemented for the WebGL backend.`);
      }
      fusedConv2d({ input, filter, convInfo, bias, activation, preluActivationWeights }) {
          const dataId = this.write(null /*values*/, convInfo.outShape, input.dtype);
          const output = tf.engine().makeTensorFromDataId(dataId, convInfo.outShape, input.dtype, this);
          const hasBias = bias != null;
          const hasPreluActivationWeights = preluActivationWeights != null;
          const fusedActivation = activation ?
              this.mapActivationToShaderProgram(activation, false) :
              null;
          let program;
          const workPerThread = tf.env().get('WEBGPU_CONV2D_WORK_PER_THREAD');
          if (workPerThread === -1) {
              // TODO(kainino0x): This may be obsolete, but is kept for reference.
              program = new Conv2DNaiveProgram(convInfo, hasBias, fusedActivation, hasPreluActivationWeights);
          }
          else {
              program = new Conv2DMMProgram(convInfo, workPerThread, hasBias, fusedActivation, hasPreluActivationWeights);
          }
          const pad = [convInfo.padInfo.top, convInfo.padInfo.left];
          const dimensions = [
              convInfo.filterHeight, convInfo.filterWidth, ...pad,
              convInfo.strideHeight, convInfo.strideWidth, convInfo.dilationHeight,
              convInfo.dilationWidth
          ];
          const inputs = [input, filter];
          if (hasBias) {
              inputs.push(bias);
          }
          if (hasPreluActivationWeights) {
              inputs.push(preluActivationWeights);
          }
          return this.compileAndRun(program, inputs, output, dimensions);
      }
      argMinMaxReduce(x, axis, reduceType) {
          const program = new ArgMinMaxProgram(x.shape, axis, reduceType);
          const output = this.makeOutputArray(program.outputShape, 'int32');
          return this.compileAndRun(program, [x], output, [axis]);
      }
      argMin(x, axis) {
          return this.argMinMaxReduce(x, axis, 'min');
      }
      argMax(x, axis) {
          return this.argMinMaxReduce(x, axis, 'max');
      }
      reduce(x, reduceType, dtype) {
          const batchSize = x.shape[0];
          const inSize = x.shape[1];
          const windowSize = tf.backend_util.computeOptimalWindowSize(inSize);
          const reduceInfo = { windowSize, inSize, batchSize };
          const program = new ReduceProgram(reduceInfo, reduceType);
          const output = this.makeOutputArray(program.outputShape, dtype);
          return this.compileAndRun(program, [x], output);
      }
      max(x, axes) {
          tf.backend_util.assertAxesAreInnerMostDims('max', axes, x.rank);
          const [outShape, reduceShape] = tf.backend_util.computeOutAndReduceShapes(x.shape, axes);
          const reduceSize = tf.util.sizeFromShape(reduceShape);
          const a2D = x.as2D(-1, reduceSize);
          return this.reduce(a2D, 'max', a2D.dtype).reshape(outShape);
      }
      min(x, axes) {
          tf.backend_util.assertAxesAreInnerMostDims('min', axes, x.rank);
          const [outShape, reduceShape] = tf.backend_util.computeOutAndReduceShapes(x.shape, axes);
          const reduceSize = tf.util.sizeFromShape(reduceShape);
          const a2D = x.as2D(-1, reduceSize);
          return this.reduce(a2D, 'min', a2D.dtype).reshape(outShape);
      }
      sum(x, axes) {
          tf.backend_util.assertAxesAreInnerMostDims('sum', axes, x.rank);
          const [outShape, reduceShape] = tf.backend_util.computeOutAndReduceShapes(x.shape, axes);
          const reduceSize = tf.util.sizeFromShape(reduceShape);
          const a2D = x.as2D(-1, reduceSize);
          const outputDType = tf.sumOutType(x.dtype);
          return this.reduce(a2D, 'sum', outputDType).reshape(outShape);
      }
      clip(x, min, max) {
          const program = new ClipProgram(x.shape, min, max);
          return this.compileAndRun(program, [x]);
      }
      slice(x, begin, size) {
          if (this.shouldExecuteOnCPU([x])) {
              return this.cpuBackend.slice(x, begin, size);
          }
          // Short-circuit computation if the slice is zero-sized.
          if (tf.util.sizeFromShape(size) === 0) {
              return tf.engine().makeTensor([], size, x.dtype, this);
          }
          // TODO(xing.xu): Add shadow slice support.
          const program = new SliceProgram(begin, size);
          return this.compileAndRun(program, [x], null);
      }
      stridedSlice(x, begin, end, strides) {
          if (this.shouldExecuteOnCPU([x])) {
              return this.cpuBackend.stridedSlice(x, begin, end, strides);
          }
          const outShape = tf.slice_util.computeOutShape(begin, end, strides);
          if (outShape.some(axis => axis === 0)) {
              return tf.engine().makeTensor([], outShape, x.dtype, this);
          }
          const program = new StridedSliceProgram(begin, strides, outShape);
          return this.compileAndRun(program, [x]);
      }
      concat(tensors, axis) {
          if (this.shouldExecuteOnCPU(tensors)) {
              return this.cpuBackend.concat(tensors, axis);
          }
          if (tensors.length === 1) {
              return tensors[0];
          }
          // Is there a maximum number of buffers that can be uploaded to a WebGPU
          // program?
          // if (tensors.length > MAX_SSBOS_FOR_WEBGPU_PROGRAM) {
          //   const midIndex = Math.floor(tensors.length / 2);
          //   const leftSide = this.concat(tensors.slice(0, midIndex), axis);
          //   const rightSide = this.concat(tensors.slice(midIndex), axis);
          //   return this.concat([leftSide, rightSide], axis);
          // }
          const outShape = tf.backend_util.computeOutShape(tensors.map(t => t.shape), axis);
          const tensors2D = tensors.map(t => t.reshape([
              tf.util.sizeFromShape(t.shape.slice(0, axis)),
              tf.util.sizeFromShape(t.shape.slice(axis))
          ]));
          const program = new ConcatProgram(tensors2D.map(t => t.shape));
          const res = this.compileAndRun(program, tensors2D);
          return res.reshape(outShape);
      }
      multiply(a, b) {
          if (this.shouldExecuteOnCPU([a, b])) {
              return this.cpuBackend.multiply(a, b);
          }
          return this.binaryOp(a, b, MUL);
      }
      realDivide(a, b) {
          return this.binaryOp(a, b, DIV);
      }
      floorDiv(a, b) {
          return this.binaryOp(a, b, INT_DIV);
      }
      maximum(a, b) {
          if (this.shouldExecuteOnCPU([a, b])) {
              return this.cpuBackend.maximum(a, b);
          }
          return this.binaryOp(a, b, MAX);
      }
      neg(x) {
          if (this.shouldExecuteOnCPU([x])) {
              return this.cpuBackend.neg(x);
          }
          const program = new UnaryOpProgram(x.shape, NEG);
          return this.compileAndRun(program, [x]);
      }
      tanh(x) {
          const program = new UnaryOpProgram(x.shape, TANH);
          return this.compileAndRun(program, [x]);
      }
      exp(x) {
          if (this.shouldExecuteOnCPU([x])) {
              return this.cpuBackend.exp(x);
          }
          const program = new UnaryOpProgram(x.shape, EXP);
          return this.compileAndRun(program, [x]);
      }
      softmax(logits, dim) {
          const axes = tf.util.parseAxisParam([dim], logits.shape);
          const maxLogit = this.max(logits, axes);
          const expandedShape = tf.backend_util.expandShapeToKeepDim(maxLogit.shape, axes);
          const a = this.subtract(logits, maxLogit.reshape(expandedShape));
          const b = this.exp(a);
          const sumExp = this.sum(b, axes).reshape(expandedShape);
          return tf.div(b, sumExp);
      }
      log(x) {
          if (this.shouldExecuteOnCPU([x])) {
              return this.cpuBackend.log(x);
          }
          const program = new UnaryOpProgram(x.shape, LOG);
          return this.compileAndRun(program, [x]);
      }
      sigmoid(x) {
          const program = new UnaryOpProgram(x.shape, SIGMOID);
          return this.compileAndRun(program, [x]);
      }
      relu(x) {
          const program = new UnaryOpProgram(x.shape, RELU);
          return this.compileAndRun(program, [x]);
      }
      relu6(x) {
          const program = new UnaryOpProgram(x.shape, RELU6);
          return this.compileAndRun(program, [x]);
      }
      abs(x) {
          if (this.shouldExecuteOnCPU([x])) {
              return this.cpuBackend.abs(x);
          }
          const program = new UnaryOpProgram(x.shape, ABS);
          return this.compileAndRun(program, [x]);
      }
      prelu(x, alpha) {
          const program = new BinaryOpProgram(PRELU, x.shape, alpha.shape);
          return this.compileAndRun(program, [x, alpha]);
      }
      select(condition, a, b) {
          const program = new SelectProgram(condition.rank, a.shape, a.rank);
          const dtype = tf.backend_util.upcastType(a.dtype, b.dtype);
          const dataId = this.write(null /*values*/, program.outputShape, dtype);
          const output = tf.engine().makeTensorFromDataId(dataId, program.outputShape, dtype, this);
          return this.compileAndRun(program, [condition, a, b], output);
      }
      cropAndResize(image, boxes, boxIndex, cropSize, method, extrapolationValue) {
          const program = new CropAndResizeProgram(image.shape, boxes.shape, cropSize, method, extrapolationValue);
          const dataId = this.write(null /*values*/, program.outputShape, 'float32');
          const output = tf.engine().makeTensorFromDataId(dataId, program.outputShape, 'float32', this);
          return this.compileAndRun(program, [image, boxes, boxIndex], output);
      }
      fill(shape, value, dtype) {
          dtype = dtype || tf.util.inferDtype(value);
          if (dtype === 'string') {
              // String type should be handled in CPU memory.
              const values = tf.util.getArrayFromDType(dtype, tf.util.sizeFromShape(shape));
              values.fill(value);
              return tf.engine().makeTensor(values, shape, dtype, this);
          }
          else {
              const program = new FillProgram(shape, value);
              const dataId = this.write(null /*values*/, program.outputShape, dtype);
              const output = tf.engine().makeTensorFromDataId(dataId, program.outputShape, dtype, this);
              return this.compileAndRun(program, [], output);
          }
      }
      zerosLike(x) {
          return this.fill(x.shape, x.dtype === 'string' ? '' : 0, x.dtype);
      }
      resizeBilinear(x, newHeight, newWidth, alignCorners) {
          const program = new ResizeBilinearProgram(x.shape, newHeight, newWidth, alignCorners);
          const output = this.makeOutputArray(program.outputShape, 'float32');
          return this.compileAndRun(program, [x], output);
      }
      reshape(x, shape) {
          return tf.engine().makeTensorFromDataId(x.dataId, shape, x.dtype, this);
      }
      cast(x, dtype) {
          return tf.backend_util.castTensor(x, dtype, this);
      }
      transpose(x, perm) {
          if (this.shouldExecuteOnCPU([x])) {
              return this.cpuBackend.transpose(x, perm);
          }
          if (x.shape.length === 2 && tf.util.arraysEqual(perm, [1, 0])) {
              const program = new TransposeSharedProgram(x.shape, perm);
              return this.compileAndRun(program, [x]);
          }
          const program = new TransposeProgram(x.shape, perm);
          return this.compileAndRun(program, [x]);
      }
      batchToSpaceND(x, blockShape, crops) {
          tf.util.assert(x.rank <= 4, () => 'batchToSpaceND for rank > 4 with a WebGPU backend not ' +
              'implemented yet');
          const prod = blockShape.reduce((a, b) => a * b);
          const reshaped = tf.backend_util.getReshaped(x.shape, blockShape, prod);
          const permuted = tf.backend_util.getPermuted(reshaped.length, blockShape.length);
          const reshapedPermuted = tf.backend_util.getReshapedPermuted(x.shape, blockShape, prod);
          const sliceBeginCoords = tf.backend_util.getSliceBeginCoords(crops, blockShape.length);
          const sliceSize = tf.backend_util.getSliceSize(reshapedPermuted, crops, blockShape.length);
          return x.reshape(reshaped)
              .transpose(permuted)
              .reshape(reshapedPermuted)
              .slice(sliceBeginCoords, sliceSize);
      }
      spaceToBatchND(x, blockShape, paddings) {
          tf.util.assert(x.rank <= 4, () => 'spaceToBatchND for rank > 4 with a WebGPU backend not ' +
              'implemented yet');
          const prod = blockShape.reduce((a, b) => a * b);
          const completePaddings = [[0, 0]];
          completePaddings.push(...paddings);
          for (let i = 1 + blockShape.length; i < x.shape.length; ++i) {
              completePaddings.push([0, 0]);
          }
          const paddedX = x.pad(completePaddings);
          const reshapedPaddedShape = tf.backend_util.getReshaped(paddedX.shape, blockShape, prod, false);
          const permutedReshapedPaddedPermutation = tf.backend_util.getPermuted(reshapedPaddedShape.length, blockShape.length, false);
          const flattenShape = tf.backend_util.getReshapedPermuted(paddedX.shape, blockShape, prod, false);
          return paddedX.reshape(reshapedPaddedShape)
              .transpose(permutedReshapedPaddedPermutation)
              .reshape(flattenShape);
      }
      batchMatMul(a, b, transposeA, transposeB) {
          const outerShapeA = transposeA ? a.shape[2] : a.shape[1];
          const outerShapeB = transposeB ? b.shape[1] : b.shape[2];
          const [batch, ,] = a.shape;
          const dataId = this.write(null /*values*/, [batch, outerShapeA, outerShapeB], a.dtype);
          const output = tf.engine().makeTensorFromDataId(dataId, [batch, outerShapeA, outerShapeB], a.dtype, this);
          let program;
          // TODO: We should eventually use the blocked version, but keeping around
          // the old version while we try to understand conditions under which blocked
          // is faster.
          if (tf.env().get('WEBGPU_MATMUL_WORK_PER_THREAD') === 0) {
              program = new MatMulProgram(a.shape, output.shape, transposeA, transposeB);
          }
          else {
              program = new MatMulPackedProgram(a.shape, output.shape, tf.env().get('WEBGPU_MATMUL_WORK_PER_THREAD'), transposeA, transposeB);
          }
          return this.compileAndRun(program, [a, b], output);
      }
      fromPixels(pixels, numChannels) {
          if (pixels == null) {
              throw new Error('pixels passed to tf.browser.fromPixels() can not be null');
          }
          const outShape = [pixels.height, pixels.width, numChannels];
          let imageData = pixels.data;
          if (tf.env().getBool('IS_BROWSER')) {
              if (!(pixels instanceof HTMLVideoElement) &&
                  !(pixels instanceof HTMLImageElement) &&
                  !(pixels instanceof HTMLCanvasElement) &&
                  !(pixels instanceof ImageData) &&
                  !(pixels.data instanceof Uint8Array)) {
                  throw new Error('pixels passed to tf.browser.fromPixels() must be either an ' +
                      `HTMLVideoElement, HTMLImageElement, HTMLCanvasElement, ImageData` +
                      ` or {data: Uint32Array, width: number, height: number}, ` +
                      `but was ${pixels.constructor.name}`);
              }
              if (pixels instanceof HTMLVideoElement ||
                  pixels instanceof HTMLImageElement ||
                  pixels instanceof HTMLCanvasElement) {
                  if (this.fromPixels2DContext == null) {
                      this.fromPixels2DContext =
                          document.createElement('canvas').getContext('2d');
                  }
                  this.fromPixels2DContext.canvas.width = pixels.width;
                  this.fromPixels2DContext.canvas.height = pixels.height;
                  this.fromPixels2DContext.drawImage(pixels, 0, 0, pixels.width, pixels.height);
                  pixels = this.fromPixels2DContext.canvas;
              }
              // TODO: Remove this once we figure out how to upload textures directly to
              // WebGPU.
              const imageDataLivesOnGPU = pixels instanceof HTMLVideoElement ||
                  pixels instanceof HTMLImageElement ||
                  pixels instanceof HTMLCanvasElement;
              if (imageDataLivesOnGPU) {
                  imageData = this.fromPixels2DContext
                      .getImageData(0, 0, pixels.width, pixels.height)
                      .data;
              }
          }
          // TODO: Encoding should happen on GPU once we no longer have to download
          // image data to the CPU.
          let pixelArray = imageData;
          if (numChannels != null && numChannels !== 4) {
              pixelArray = new Uint8Array(pixels.width * pixels.height * numChannels);
              const dataLength = imageData.length;
              let j = 0;
              for (let i = 0; i < dataLength; i++) {
                  if (i % 4 < numChannels) {
                      pixelArray[j++] = imageData[i];
                  }
              }
          }
          const output = this.makeOutputArray(outShape, 'int32');
          const info = this.tensorMap.get(output.dataId);
          info.values = new Int32Array(pixelArray);
          this.maybeReleaseBuffer(output.dataId);
          this.uploadToGPU(output.dataId);
          return output;
      }
      numDataIds() {
          return this.tensorMap.numDataIds();
      }
      dispose() {
          if (this.disposed) {
              return;
          }
          this.bufferManager.dispose();
          this.disposed = true;
      }
  }

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

  var webgpu = /*#__PURE__*/Object.freeze({
    __proto__: null,
    webgpu_util: webgpu_util,
    WebGPUBackend: WebGPUBackend
  });

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
  tf.registerBackend('webgpu', async () => {
      const glslang = await glslangInit();
      const gpuDescriptor = {
          powerPreference: tf.env().get('WEBGPU_USE_LOW_POWER_GPU') ?
              'low-power' :
              'high-performance'
      };
      const adapter = await navigator.gpu.requestAdapter(gpuDescriptor);
      const device = await adapter.requestDevice({});
      return new WebGPUBackend(device, glslang);
  }, 3 /*priority*/);

  exports.webgpu = webgpu;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=tf-webgpu.es2017.js.map