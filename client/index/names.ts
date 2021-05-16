import * as user from '../shared/user';
import * as log from '../shared/log';

let visible = false;

const thumbSize = 96;
let div;
const people: Array<any> = [];

const byrc = function (arr, seed = 0) {
  // by @byrc: two uncorrelated 32-bit hashes computed in parallel with return value being limited by JS to 53-bit integer, similar but simplified well-known MurmurHash/xxHash algorithms
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < arr.length; i++) {
    h1 = Math.imul(h1 ^ arr[i], 2654435761);
    h2 = Math.imul(h2 ^ arr[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

export function close() {
  document.body.removeChild(div);
  visible = false;
}

function updateObject(obj) {
  const inputs = document.getElementsByClassName('person-input');
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i] as HTMLInputElement;
    const names = input.value.split(' ').filter((a) => a.length > 0);
    if (names.length > 0) {
      obj.person[i].names = names;
    } else { // if input is empty unregister names
      if (obj.person[i].names) delete obj.person[i].names;
      if (obj.person[i].hash) delete obj.person[i].hash;
    }
  }

  fetch('/api/record/put', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) })
    .then((post) => {
      post.json();
      log.div('log', true, `update record: ${obj.image}`);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      log.div('process-log', true, `Error posting: ${obj.image} size: ${JSON.stringify(obj).length}`);
    });

  close();
}

function addPerson(person, obj, img) {
  const child = document.createElement('div');
  child.style.width = 'fit-content';

  const canvas = document.createElement('canvas');
  canvas.height = thumbSize;
  canvas.width = thumbSize;
  canvas.style.background = 'var(--body)';
  const ctx = canvas.getContext('2d');
  const box = [
    Math.trunc(img.naturalWidth * person.boxRaw[0]),
    Math.trunc(img.naturalHeight * person.boxRaw[1]),
    Math.trunc(img.naturalWidth * person.boxRaw[2]),
    Math.trunc(img.naturalHeight * person.boxRaw[3]),
  ];
  ctx?.drawImage(img, box[0], box[1], box[2], box[3], 0, 0, canvas.width, canvas.height);

  const label = document.createElement('label');
  label.innerText = 'Names:';
  label.style.verticalAlign = 'top';
  label.style.paddingLeft = '16px';

  const input = document.createElement('input');
  input.className = 'input person-input';
  input.type = 'search';
  input.id = person.hash || byrc(person.descriptor).toString(); // use existing hash or create new one
  input.value = (person.names && person.names.length > 0) ? person.names.join(' ') : ''; // use existing names
  input.style.width = '50vw';
  input.style.left = '-4rem';
  input.style.top = '2.5rem';
  input.style.position = 'relative';
  label.appendChild(input);

  if (!person.hash) person.hash = byrc(person.descriptor);
  people.push(person);

  input.addEventListener('search', () => updateObject(obj));

  child.appendChild(canvas);
  child.appendChild(label);

  return child;
}

function addObject(obj, img) {
  visible = true;

  div = document.createElement('div');
  div.className = 'names';
  div.id = 'names-list';
  for (const person of obj.person) {
    if (person.boxRaw && (person.boxRaw.length === 4) && person.descriptor && (person.descriptor.length >= 128)) {
      div.appendChild(addPerson(person, obj, img));
    }
  }
  div.addEventListener('click', (evt) => {
    if (evt.target.id === 'names-list') close();
  });
  document.body.appendChild(div);
}

export async function show(obj) {
  if (!user.user.admin) {
    log.div('log', true, 'error: must be admin to edit names');
    return;
  }
  people.length = 0;
  if (visible && div) {
    close();
    return;
  }
  if (!obj || !obj.person || obj.person.length === 0) return;
  const img = document.getElementsByClassName('iv-large-image')[0] as HTMLImageElement;
  if (!img || !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return;

  addObject(obj, img);
}
