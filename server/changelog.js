const fs = require('fs');
const path = require('path');
const moment = require('moment');
const simpleGit = require('simple-git/promise');
const logger = require('@vladmandic/pilogger');

const git = simpleGit();

async function update(f) {
  let text = '# PiGallery Change Log\n';
  const all = await git.log();
  const log = all.all.sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime()));
  // console.log(log);
  for (let i = 0; i < log.length; i++) {
    if (log[i].refs !== '') {
      let ver = log[i].refs.split(' ');
      ver = ver[ver.length - 1];
      const date = moment(log[i].date).format('YYYY/MM/DD');
      if (ver !== 'master') text += `\n### **${ver}** ${date} ${log[i].author_email}\n\n`;
    } else if (log[i].message !== '') {
      text += `- ${log[i].message}\n`;
    }
  }
  // process.stdout.write(text);
  const name = path.join(__dirname, '../', f);
  fs.writeFileSync(name, text);
  logger.state('Change log updated:', name);
}

exports.update = update;

if (!module.parent) {
  update('CHANGELOG.md');
}
