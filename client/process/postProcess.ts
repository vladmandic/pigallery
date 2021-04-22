// eslint-disable-next-line import/prefer-default-export
export async function nsfw(model, detected) {
  if (!detected) return null;
  const labelPerson = [6, 7];
  const labelSexy = [0, 3, 4, 5, 10, 11, 12, 13];
  const labelNude = [0, 11, 13];
  const found = { person: false, sexy: false, nude: false };
  for (const item of detected) {
    if (labelPerson.includes(item.id)) found.person = true;
    if (labelSexy.includes(item.id)) found.sexy = true;
    if (labelNude.includes(item.id)) found.nude = true;
  }
  const result:Array<{ score: number, id: number, class: string}> = [];
  // if (found.person) result.push({ score: 1, id: 100, class: 'person' });
  if (found.sexy) result.push({ score: 1, id: 100, class: 'sexy' });
  if (found.nude) result.push({ score: 1, id: 101, class: 'nude' });
  return result;
}
