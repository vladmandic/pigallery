import * as hash from '../shared/blockhash';

onmessage = async (msg) => {
  // console.log('Worker received message', msg.data);
  const all = msg.data;
  let duplicates = [];
  let duplicate;
  for (let i = 0; i < all.length; i++) {
    duplicate = false;
    for (let j = i + 1; j < all.length; j++) {
      const distance = all[i].hash === all[j].hash ? 0 : hash.distance(all[i].phash, all[j].phash);
      if (distance < 100) {
        all[i].similarity = distance;
        all[j].similarity = distance;
        duplicate = true;
        duplicates.push(all[j]);
      }
    }
    if (duplicate) duplicates.push(all[i]);
  }
  duplicates = [...new Set(duplicates)];
  duplicates = duplicates.sort((a, b) => (b.similarity - a.similarity));
  // @ts-ignore
  postMessage(duplicates);
};
