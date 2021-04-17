import * as hash from '../shared/blockhash';

onmessage = async (msg) => {
  // console.log('Worker received message', msg.data);
  const all = msg.data;
  const duplicatePairs = [];
  // generate possible duplicate pairs of images
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const distance = all[i].hash === all[j].hash ? 0 : hash.distance(all[i].phash, all[j].phash);
      if (distance < 15) duplicatePairs.push({ source: all[i], target: all[j], distance });
    }
  }
  // now place them in a flat array
  const duplicateItems = [];
  for (const pair of duplicatePairs) {
    if (pair.source.image !== pair.target.image) {
      pair.source.similarity = 100 - pair.distance;
      pair.target.similarity = 100 - pair.distance;
      // need a deep copy since similarty gets overwritten
      duplicateItems.push({ ...pair.source });
      duplicateItems.push({ ...pair.target });
    }
  }
  const foundItems = [];
  const deduplicate = (item) => {
    if (foundItems.includes(`${item.image}:${item.similarity}`)) return false;
    foundItems.push(`${item.image}:${item.similarity}`);
    return true;
  };
  // deduplicate images flat array and sort by similarity
  const sorted = duplicateItems
    .filter((a) => deduplicate(a))
    .sort((a, b) => (b.similarity - a.similarity));

  // return results to parent process
  // @ts-ignore
  postMessage(sorted);
};
