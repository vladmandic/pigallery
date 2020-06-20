const fs = require('fs');
const proc = require('process');
const path = require('path');

async function main() {
  const dir = proc.argv[2] || '.';
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.startsWith('IMG_')) continue;
    const d = {
      // IMG_20190415_115013_316.jpg
      YYYY: file.substr(4, 4),
      MM: file.substr(8, 2),
      DD: file.substr(10, 2),
      hh: file.substr(13, 2),
      mm: file.substr(15, 2),
      ss: file.substr(17, 2),
    };
    const dt = new Date(`${d.YYYY}/${d.MM}/${d.DD} ${d.hh}:${d.mm}:${d.ss}`);
    console.log(path.join(dir, file), dt);
    fs.utimesSync(path.join(dir, file), dt, dt);
  }
}

main();
