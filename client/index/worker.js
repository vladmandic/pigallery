import * as hash from '../shared/blockhash';

onmessage = async (msg) => {
  // console.log('Worker received message', msg.data);
  const all = msg.data;
  let duplicates = [];
  let duplicate;
  const length = all.length - 1;
  for (let i = 0; i < length + 1; i++) {
    const a = all[i];
    duplicate = false;
    for (let j = i + 1; j < length; j++) {
      const b = all[j];
      const distance = (a.hash === b.hash) ? 0 : (hash.distance(a.phash, b.phash) + 1);
      if (distance < 35) {
        a.similarity = distance;
        b.similarity = distance;
        duplicate = true;
        duplicates.push(b);
      }
    }
    if (duplicate) duplicates.push(a);
  }
  duplicates = [...new Set(duplicates)];
  duplicates = duplicates.sort((a, b) => (a.similarity - b.similarity));
  postMessage(duplicates, 'pigallery');
};
