/* eslint-disable func-names */

// Perceptual image hash
// Based on https://github.com/commonsmachinery/blockhash-js
// Which is an implementation ofBlock Mean Value Based Image Perceptual Hashing by Bian Yang, Fan Gu and Xiamu Niu

const one_bits = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

const median = function (data) {
  const mdarr = data.slice(0);
  mdarr.sort((a, b) => a - b);
  if (mdarr.length % 2 === 0) {
    return (mdarr[mdarr.length / 2 - 1] + mdarr[mdarr.length / 2]) / 2.0;
  }
  return mdarr[Math.floor(mdarr.length / 2)];
};

const translate_blocks_to_bits = function (blocks, pixels_per_block) {
  const half_block_value = pixels_per_block * 256 * 3 / 2;
  const bandsize = blocks.length / 4;
  for (let i = 0; i < 4; i++) {
    const m = median(blocks.slice(i * bandsize, (i + 1) * bandsize));
    for (let j = i * bandsize; j < (i + 1) * bandsize; j++) {
      const v = blocks[j];
      blocks[j] = Number(v > m || (Math.abs(v - m) < 1 && m > half_block_value));
    }
  }
};

const bits_to_hexhash = function (bitsArray) {
  const hex = [];
  for (let i = 0; i < bitsArray.length; i += 4) {
    const nibble = bitsArray.slice(i, i + 4);
    hex.push(parseInt(nibble.join(''), 2).toString(16));
  }
  return hex.join('');
};

const bmvbhash_even = function (data, bits) {
  const blocksize_x = Math.floor(data.width / bits);
  const blocksize_y = Math.floor(data.height / bits);
  const result = [];
  for (let y = 0; y < bits; y++) {
    for (let x = 0; x < bits; x++) {
      let total = 0;
      for (let iy = 0; iy < blocksize_y; iy++) {
        for (let ix = 0; ix < blocksize_x; ix++) {
          const cx = x * blocksize_x + ix;
          const cy = y * blocksize_y + iy;
          const ii = (cy * data.width + cx) * 4;
          const alpha = data.data[ii + 3];
          if (alpha === 0) total += 765;
          else total += data.data[ii] + data.data[ii + 1] + data.data[ii + 2];
        }
      }
      result.push(total);
    }
  }
  translate_blocks_to_bits(result, blocksize_x * blocksize_y);
  return bits_to_hexhash(result);
};

const bmvbhash = function (data, bits) {
  const result = [];
  let weight_top;
  let weight_bottom;
  let weight_left;
  let weight_right;
  let block_top;
  let block_bottom;
  let block_left;
  let block_right;
  let y_mod;
  let y_frac;
  let y_int;
  let x_mod;
  let x_frac;
  let x_int;
  const blocks = [];
  const even_x = data.width % bits === 0;
  const even_y = data.height % bits === 0;
  if (even_x && even_y) return bmvbhash_even(data, bits);
  for (let i = 0; i < bits; i++) {
    blocks.push([]);
    for (let j = 0; j < bits; j++) {
      // @ts-ignore
      blocks[i].push(0);
    }
  }
  const block_width = data.width / bits;
  const block_height = data.height / bits;
  for (let y = 0; y < data.height; y++) {
    if (even_y) {
      block_bottom = Math.floor(y / block_height);
      block_top = block_bottom;
      weight_top = 1;
      weight_bottom = 0;
    } else {
      y_mod = (y + 1) % block_height;
      y_frac = y_mod - Math.floor(y_mod);
      y_int = y_mod - y_frac;
      weight_top = (1 - y_frac);
      weight_bottom = (y_frac);
      if (y_int > 0 || (y + 1) === data.height) {
        block_bottom = Math.floor(y / block_height);
        block_top = block_bottom;
      } else {
        block_top = Math.floor(y / block_height);
        block_bottom = Math.ceil(y / block_height);
      }
    }
    for (let x = 0; x < data.width; x++) {
      let avgvalue;
      const ii = (y * data.width + x) * 4;
      const alpha = data.data[ii + 3];
      if (alpha === 0) avgvalue = 765;
      else avgvalue = data.data[ii] + data.data[ii + 1] + data.data[ii + 2];
      if (even_x) {
        block_right = Math.floor(x / block_width);
        block_left = block_right;
        weight_left = 1;
        weight_right = 0;
      } else {
        x_mod = (x + 1) % block_width;
        x_frac = x_mod - Math.floor(x_mod);
        x_int = x_mod - x_frac;
        weight_left = (1 - x_frac);
        weight_right = x_frac;
        if (x_int > 0 || (x + 1) === data.width) {
          block_right = Math.floor(x / block_width);
          block_left = block_right;
        } else {
          block_left = Math.floor(x / block_width);
          block_right = Math.ceil(x / block_width);
        }
      }
      // @ts-ignore
      blocks[block_top][block_left] += avgvalue * weight_top * weight_left;
      // @ts-ignore
      blocks[block_top][block_right] += avgvalue * weight_top * weight_right;
      // @ts-ignore
      blocks[block_bottom][block_left] += avgvalue * weight_bottom * weight_left;
      // @ts-ignore
      blocks[block_bottom][block_right] += avgvalue * weight_bottom * weight_right;
    }
  }
  for (let i = 0; i < bits; i++) {
    for (let j = 0; j < bits; j++) result.push(blocks[i][j]);
  }
  translate_blocks_to_bits(result, block_width * block_height);
  return bits_to_hexhash(result);
};

async function calculateHashData(data, bits = 16) {
  return new Promise((resolve, reject) => {
    try {
      const hash = bmvbhash(data, bits);
      resolve(hash);
    } catch (err) {
      reject(err);
    }
  });
}

/* Calculate the hamming distance for two hashes in hex format */
function distance(hash1, hash2) {
  let d = 0;
  if (hash1.length !== hash2.length) return Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < hash1.length; i++) {
    const n1 = parseInt(hash1[i], 16);
    const n2 = parseInt(hash2[i], 16);
    d += one_bits[n1 ^ n2];
  }
  return d;
}

module.exports = {
  distance,
  data: calculateHashData,
};
