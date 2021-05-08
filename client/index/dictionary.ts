export const skip = ['in', 'a', 'the', 'of', 'with', 'using', 'wearing', 'and', 'at', 'during', 'on', 'having', 'eating'];

export const related = [
  ['girl', 'female', 'woman'],
  ['building', 'architecture', 'house', 'skyscraper', 'palace', 'lighthouse'],
  ['church', 'monastery'],
  ['food', 'produce', 'meal', 'dinner', 'dining'],
  ['motorcycle', 'motorbike', 'bike'],
];

export const synonyms = (word) => {
  const res: Array<string> = [];
  for (const item of related) {
    if (item.includes(word)) res.push(...item);
  }
  if (res.length === 0) res.push(word); // default
  return res;
};
