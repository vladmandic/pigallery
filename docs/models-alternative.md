# Alternative models

Some tested alternative models...

```js
{
  classify: [
    { name: 'ImageNet Inception v4', modelPath: 'models/imagenet/inception-v4', tensorSize: 299, scaleScore: 200, offset: 1 },
    { name: 'ImageNet EfficientNet B4', modelPath: 'models/imagenet/efficientnet-b4', tensorSize: 380, minScore: 0.35, scaleScore: 1 },
    { name: 'DeepDetect Inception v3', modelPath: 'models/deepdetect/inception-v3', tensorSize: 299, minScore: 0.35, scaleScore: 2000 },
  ],
  detect: [
    { name: 'COCO EfficientDet D0', modelPath: 'models/coco/efficientdet-d0', minScore: 0.2, scaleOutput: true },
    { name: 'COCO EfficientDet D1', modelPath: 'models/coco/efficientdet-d1', minScore: 0.2, scaleOutput: true },
    { name: 'COCO EfficientDet D2', modelPath: 'models/coco/efficientdet-d2', minScore: 0.2, scaleOutput: true },
    { name: 'COCO EfficientDet D3', modelPath: 'models/coco/efficientdet-d3', minScore: 0.2, scaleOutput: true, maxResults: 20 },
    { name: 'COCO EfficientDet D4', modelPath: 'models/coco/efficientdet-d4', minScore: 0.2, scaleOutput: true },
    { name: 'COCO EfficientDet D5', modelPath: 'models/coco/efficientdet-d5', minScore: 0.2, scaleOutput: true },
    { name: 'COCO EfficientDet D6', modelPath: 'models/coco/efficientdet-d6', minScore: 0.2, scaleOutput: true },
    { name: 'COCO EfficientDet D7', modelPath: 'models/coco/efficientdet-d7', minScore: 0.2, scaleOutput: true },
    { name: 'COCO SSD MobileNet v2', modelPath: 'models/coco/ssd-mobilenet-v2', minScore: 0.4, scaleOutput: true, maxResults: 20 }, // fast and imprecise
    { name: 'COCO RetinaNet ResNet101 v1', modelPath: 'models/coco/retinanet-resnet101-v1' },
    { name: 'COCO RetinaNet ResNet152 v1', modelPath: 'models/coco/retinanet-resnet152-v1' },
    { name: 'COCO Faster-RCNN ResNet101 v1', modelPath: 'models/coco/fasterrcnn-resnet101-v1' },
    { name: 'COCO Faster-RCNN ResNet152 v1', modelPath: 'models/coco/fasterrcnn-resnet152-v1' },
    { name: 'OpenImages SSD MobileNet v2', modelPath: 'models/openimages/ssd-mobilenet-v2', minScore: 0.15, normalizeInput: 1.0 / 255, maxResults: 20,
      map: { boxes: 'module_apply_default/hub_input/strided_slice:0', scores: 'module_apply_default/hub_input/strided_slice_1:0', classes: 'module_apply_default/hub_input/strided_slice_2:0' } },
    { name: 'OpenImages Faster-RCNN Inception ResNet v2', modelPath: 'models/openimages/faster-rcnn-resnet-v2', minScore: 0.05, normalizeInput: 1.0 / 255,
      map: { boxes: 'module_apply_default/hub_input/strided_slice:0', scores: 'module_apply_default/hub_input/strided_slice_1:0', classes: 'module_apply_default/hub_input/strided_slice_2:0' } },
    { name: 'OpenImages Faster-RCNN Inception ResNet v2 Atrous', modelPath: 'models/openimages/faster-rcnn-inception-resnet-v2-atrous', minScore: 0.05, normalizeInput: 1.0 / 255,
      map: { boxes: 'detection_boxes:0', scores: 'detection_scores:0', classes: 'detection_classes:0' } },
    { name: 'COCO CenterNet ResNet50-v2', modelPath: 'models/coco/centernet-resnet50-v2', minScore: 0.3, maxResults: 20,
      map: { boxes: 'Identity:0', scores: 'Identity_2:0', classes: 'Identity_1:0' } },
  ],
};
```

<br><hr><br>

## Testing Notes

- Using Intel i7 with nVidia GTX-1050Ti
- Sample is of 1,000 random images with processing size normalized to 780px

|                          |                      |              |         |        |         |            |             | Top 1% Accuracy |           |        |        |
|--------------------------|----------------------|--------------|---------|--------|---------|------------|-------------|-----------------|-----------|--------|--------|
| Model                    | Type                 | Training Set | Classes | Size   | Tensors | Resolution | Performance | Correct         | Incorrect | Best   | Empty  |
| MobileNet v1             | Image Classification | ImageNet     | 1000    | 16 MB  | 59      | 224 px     | 150 ms      | 75.79%          | 14.74%    | 0.00%  | 9.47%  |
| MobileNet v2             | Image Classification | ImageNet     | 1000    | 13 MB  | 125     | 224 px     | 112 ms      | 75.79%          | 10.53%    | 10.53% | 13.68% |
| Inception v1             | Image Classification | ImageNet     | 1000    | 25 MB  | 120     | 224 px     | 230 ms      | 69.47%          | 9.47%     | 9.47%  | 21.05% |
| Inception v2             | Image Classification | ImageNet     | 1000    | 43 MB  | 145     | 224 px     | 165 ms      | 80.00%          | 5.26%     | 5.26%  | 14.74% |
| Inception v3             | Image Classification | ImageNet     | 1000    | 91 MB  | 194     | 224 px     | 203 ms      | 89.47%          | 10.53%    | 10.53% | 0.00%  |
| Inception v4             | Image Classification | ImageNet     | 1000    | 163 MB | 304     | 300 px     | 299 ms      | 94.74%          | 5.26%     | 10.53% | 0.00%  |
| ResNet v2-50             | Image Classification | ImageNet     | 1000    | 98 MB  | 147     | 224 px     | 128 ms      | 83.16%          | 14.74%    | 14.74% | 2.11%  |
| ResNet v2-101            | Image Classification | ImageNet     | 1000    | 170 MB | 283     | 224 px     | 94 ms       | 82.11%          | 15.79%    | 15.79% | 2.11%  |
| Inception-ResNet v2      | Image Classification | ImageNet     | 1000    | 213 MB | 500     | 224 px     | 228 ms      | 91.58%          | 8.42%     | 8.42%  | 0.00%  |
| NASNet-A Mobile          | Image Classification | ImageNet     | 1000    | 20 MB  | 574     | 224 px     | 170 ms      | 85.26%          | 11.58%    | 11.58% | 3.16%  |
| EfficientNet B0          | Image Classification | ImageNet     | 1000    | 20 MB  | 168     | 224 px     | 134 ms      | 83.16%          | 6.32%     | 6.32%  | 10.53% |
| EfficientNet B4          | Image Classification | ImageNet     | 1000    | 74 MB  | 338     | 380 px     | 438 ms      | 91.58%          | 3.16%     | 3.16%  | 5.26%  |
| EfficientNet B5          | Image Classification | ImageNet     | 1000    | 116 MB | 394     | 456 px     | 448 ms      | 94.00%          | 2.00%     | 3.16%  | 3.15%  |
| EfficientNet B7          | Image Classification | ImageNet     | 1000    | 253 MB | 552     | 600 px     | 995 ms      | 96.84%          | 1.05%     | 1.05%  | 2.11%  |
| DeepDetect               | Image Classification | DeepDetect   | 6012    | 130 MB | 191     | 300 px     | 189 ms      | 87.37%          | 12.63%    | 2.11%  | 0.00%  |
| SSD/MobileNet v1         | Object Detection     | Coco         | 90      | 26 MB  | 163     | 224 px     | 120 ms      | 62.11%          | 9.47%     | 0.00%  | 28.42% |
| SSD/MobileNet v2         | Object Detection     | Coco         | 90      | 64 MB  | 202     | 224 px     | 147 ms      | 67.37%          | 8.42%     | 0.00%  | 24.21% |
| Yolo/DarkNet v1 Tiny     | Object Detection     | Coco+VOC     | 100     | 61 MB  | 42      | 416 px     | -           | -               | -         | -      | -      |
| Yolo/DarkNet v2 Tiny     | Object Detection     | Coco+VOC     | 100     | 43 MB  | 42      | 416 px     | -           | -               | -         | -      | -      |
| Yolo/DarkNet v3 Tiny     | Object Detection     | Coco+VOC     | 100     | 34 MB  | 59      | 416 px     | -           | -               | -         | -      | -      |
| Yolo/DarkNet v3 Full     | Object Detection     | Coco+VOC     | 100     | 237 MB | 366     | 416 px     | -           | -               | -         | -      | -      |
| SSD/MobileNet v2         | Object Detection     | OpenImages   | 600     | 55 MB  | 1434    | 300 px     | 2709 ms     | 92.63%          | 2.11%     | 16.84% | 5.26%  |
| RCNN/Inception-ResNet v2 | Object Detection     | OpenImages   | 600     | 244 MB | 1944    | 300 px     | -           | -               | -         | -      | -      |
| MobileNet v1 Food        | Image Classification | iNaturalist  | 2023    | 20 MB  | 58      | 192 px     | 45 ms       | -               | -         | -      | -      |
| MobileNet v2 Plants      | Image Classification | iNaturalist  | 2100    | 19 MB  | 169     | 224 px     | 58 ms       | -               | -         | -      | -      |
| MobileNet v2 Birds       | Image Classification | iNaturalist  | 963     | 13 MB  | 170     | 224 px     | 34 ms       | -               | -         | -      | -      |
| MobileNet v2 Insects     | Image Classification | iNaturalist  | 1020    | 13 MB  | 169     | 224 px     | 32 ms       | -               | -         | -      | -      |
