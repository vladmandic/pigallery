# TODO

## Future Features

- User DB management client-side
- User DB check server-side
- Move compare to main app as test feature
- Switch backend DB from NEDB to Mongo
- Document HTTPrest API
- Enable reprocess for specific entries

## Desired Models

Didn't find:
- Places365: all found pre-trained weights are for PyTorch
- Objects365: new dataset, no public pre-trained weights so far

## Interesting models

- Google BiT <https://tfhub.dev/google/collections/bit/1>: Large models pretrained on ImageNet 1k and 21k  
  r050x1 1k=91MB   21k=240MB  
  r050x3 1k=770MB  21k=1190MB  
  r101x1 1k=159MB  21k=308MB  
  r101x3 1k=1340MB 21k=1780MB  
  r152x4 1=2733MB  21k=4179MB
- Google Landmarks: <https://tfhub.dev/google/collections/landmarks/1>
- Google Food: <https://tfhub.dev/google/aiy/vision/classifier/food_V1/1>
- Google Supermarket Products: <https://tfhub.dev/google/on_device_vision/classifier/popular_us_products_V1/1>
- iNaturalist: 2017 dataset 5089 classs from 0.6M images in 237GB  
  Note: competition uses obfucated taxonomy since 2018, so categories must be downloaded separately after the competition  
  iNaturalist: <https://tfhub.dev/s?q=inaturalist> <https://github.com/richardaecn/cvpr18-inaturalist-transfer>  
  Competitions: <https://github.com/visipedia/inat_comp>  
  Dataset: <https://www.kaggle.com/c/inaturalist-2019-fgvc6/data> <https://github.com/visipedia/inat_comp/tree/master/2017>  
  Model Small: <https://www.kaggle.com/sujoykg/xception-keras/>  
  Model Large: <https://www.kaggle.com/cedriclacrambe/inaturalist-xception-512/>  
  Lexicon Latin: <https://www.gbif.org/dataset/search>  
  Lexicon Government: <https://www.itis.gov/>  
  Lookup: <http://www.gbif.org/species/{gbid}> <https://api.gbif.org/v1/species?name={name}>  
  Hierarchy: categogy -> kingdom -> phylum -> class -> order -> family -> genus -> name  
