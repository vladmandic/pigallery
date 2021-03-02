const fs = require('fs');
const path = require('path');
const moment = require('moment');
const simpleGit = require('simple-git/promise');
const logger = require('@vladmandic/pilogger');

const git = simpleGit();

async function update(f) {
  let text = '# PiGallery Change Log\n';
  const all = await git.log();
  // @ts-ignore
  const log = all.all.sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime()));

  let previous = '';
  const headings = [];
  for (const l of log) {
    const msg = l.message.toLowerCase();
    if ((l.refs !== '') || msg.match(/^[0-9].[0-9].[0-9]/)) {
      const dt = moment(l.date).format('YYYY/MM/DD');
      const ver = msg.match(/[0-9].[0-9].[0-9]/) ? msg : l.refs;
      const heading = `\n## **${ver}** ${dt} ${l.author_email}\n\n`;
      if (!headings.includes(heading) && !ver.startsWith('tag') && !ver.startsWith('HEAD')) {
        headings.push(heading);
        text += `\n## **${ver}** ${dt} ${l.author_email}\n\n`;
      }
    } else if ((msg.length > 2) && !msg.startsWith('update') && (previous !== msg)) {
      previous = msg;
      text += `- ${msg}\n`;
    }
  }

  // process.stdout.write(text);
  const name = path.join(__dirname, '../', f);
  fs.writeFileSync(name, text);
  logger.state('Change log updated:', name);
}

exports.update = update;

if (require.main === module) {
  update('CHANGELOG.md');
}
