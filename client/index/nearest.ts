// @ts-nocheck

// heavily based on https://github.com/darkskyapp/sphere-knn
// simplified and modified to implement persistent lookup array for increased performance

function spherical2cartesian(lat, lon) {
  lat *= Math.PI / 180;
  lon *= Math.PI / 180;
  const cos = Math.cos(lat);
  return [cos * Math.cos(lon), Math.sin(lat), cos * Math.sin(lon)];
}

class Position {
  object: any;
  position: any;
  // end definition

  constructor(object) {
    const lat = object.lat || object.latitude;
    const lon = object.lon || object.longitude;
    this.object = object;
    this.position = spherical2cartesian(lat, lon);
  }

  static create(object) {
    return new Position(object);
  }

  static extract(position) {
    return position.object;
  }
}

function defaultComparator(a, b) {
  return a - b;
}

const search = (item, array, comparator) => {
  if (!comparator) comparator = defaultComparator;
  let low = 0;
  let high = array.length - 1;
  let mid;
  let comp;
  while (low <= high) {
    // eslint-disable-next-line no-bitwise
    mid = (low + high) >>> 1;
    comp = comparator(array[mid], item);
    if (comp < 0) low = mid + 1;
    else if (comp > 0) high = mid - 1;
    else return mid;
  }
  return -(low + 1);
};

const insert = (item, array, comparator) => {
  let i = search(item, array, comparator);
  if (i < 0) i = -(i + 1);
  array.splice(i, 0, item);
};

function NodeEntry(axis, split, left, right) {
  this.axis = axis;
  this.split = split;
  this.left = left;
  this.right = right;
}

function distance(a, b) {
  let i = Math.min(a.length, b.length);
  let d = 0;
  let k;
  while (i--) {
    k = b[i] - a[i];
    d += k * k;
  }
  return d;
}

function byDistance(a, b) {
  return a.dist - b.dist;
}

function buildrec(array, depth) {
  if (array.length === 0) return null;
  if (array.length === 1) return array[0];
  const axis = depth % array[0].position.length;
  array.sort((a, b) => a.position[axis] - b.position[axis]);
  const i = Math.floor(array.length * 0.5);
  ++depth;
  return new NodeEntry(axis, array[i].position[axis], buildrec(array.slice(0, i), depth), buildrec(array.slice(i), depth));
}

function lookup(position, node, maxCount, maxDistance) {
  const array = [];
  if (node === null || maxCount <= 0) return array;
  const stack = [node, 0];
  let dist;
  while (stack.length) {
    dist = stack.pop();
    node = stack.pop();
    if (array.length === maxCount && array[array.length - 1].dist < dist * dist) continue;
    while (node instanceof NodeEntry) {
      if (position[node.axis] < node.split) {
        stack.push(node.right, node.split - position[node.axis]);
        node = node.left;
      } else {
        stack.push(node.left, position[node.axis] - node.split);
        node = node.right;
      }
    }
    dist = distance(position, node.position);
    if (dist < maxDistance) insert({ object: node, dist }, array, byDistance);
    if (array.length > maxCount) array.pop();
  }
  // let i;
  // i = array.length;
  // while (i--) array[i] = array[i].object;
  return array;
}

function find(points, lat, lon, maxCount, maxDistance) {
  const nodes = buildrec(points.map(Position.create), 0);
  // return lookup(spherical2cartesian(lat, lon), nodes, n).map(Position.extract);
  const coord = spherical2cartesian(lat, lon);
  const list = lookup(coord, nodes, maxCount, maxDistance);
  const res = list.map((a) => ({ dist: a.dist, lat: a.object.object.lat, lon: a.object.object.lon }));
  return res;
}

export { find };
