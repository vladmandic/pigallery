// based on https://github.com/darkskyapp/sphere-knn

/* eslint-disable no-continue */
/* eslint-disable no-param-reassign */
/* eslint-disable no-prototype-builtins */

const log = require('pilogger');

const geo = {};

function spherical2cartesian(lat, lon) {
  lat *= Math.PI / 180;
  lon *= Math.PI / 180;
  const cos = Math.cos(lat);
  return [cos * Math.cos(lon), Math.sin(lat), cos * Math.sin(lon)];
}

class Position {
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

function Node(axis, split, left, right) {
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
  return new Node(axis, array[i].position[axis], buildrec(array.slice(0, i), depth), buildrec(array.slice(i), depth));
}

function kdlookup(position, node, n) {
  const array = [];
  if (node === null || n <= 0) return array;
  const stack = [node, 0];
  let dist;
  let i;
  while (stack.length) {
    dist = stack.pop();
    node = stack.pop();
    if (array.length === n && array[array.length - 1].dist < dist * dist) continue;
    while (node instanceof Node) {
      if (position[node.axis] < node.split) {
        stack.push(node.right, node.split - position[node.axis]);
        node = node.left;
      } else {
        stack.push(node.left, position[node.axis] - node.split);
        node = node.right;
      }
    }
    dist = distance(position, node.position);
    insert({ object: node, dist }, array, byDistance);
    if (array.length > n) array.pop();
  }
  i = array.length;
  while (i--) array[i] = array[i].object;
  return array;
}

function nearest(lat, lon, where, n) {
  // const node = buildrec(points.map(Position.create), 0);
  let node;
  if (where === 'all') node = geo.all;
  if (where === 'large') node = geo.large;
  return kdlookup(spherical2cartesian(lat, lon), node, n).map(Position.extract);
}

function init(all, large) {
  geo.all = buildrec(all.map(Position.create), 0);
  geo.large = buildrec(large.map(Position.create), 0);
  log.info('Geo all cities database:', geo.all.length);
  log.info('Geo large cities database:', geo.large.length);
}

exports.nearest = nearest;
exports.init = init;
