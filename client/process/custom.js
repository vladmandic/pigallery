async function nsfw(model, detected) {
  if (!detected) return null;
  const labelPerson = [6, 7];
  const labelSexy = [1, 2, 3, 4, 8, 9, 10, 15];
  const labelNude = [0, 5, 11, 12, 13];
  const result = [];
  for (const item of detected) {
    if (labelPerson.includes(item.id) && !result.includes('person')) result.push('person');
    if (labelSexy.includes(item.id) && !result.includes('sexy')) result.push('sexy');
    if (labelNude.includes(item.id) && !result.includes('nude')) result.push('nude');
  }
  return result;
}

exports.nsfw = nsfw;
