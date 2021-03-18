const fs = require('fs');
const path = require('path');
const moment = require('moment');
const simpleGit = require('simple-git/promise');
const logger = require('@vladmandic/pilogger');
const app = require('../package.json');

const git = simpleGit();

let text = `# ${app.name}  

Version: **${app.version}**  
Description: **${app.description}**  

Author: **${app.author}**  
License: **${app.license}** </LICENSE>  
Repository: **<${app.repository.url}>**  

## Changelog
`;

async function update(f) {
  const gitLog = await git.log();
  const log = gitLog.all.sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime()));

  let previous = '';
  const headings = [];
  for (const l of log) {
    const msg = l.message.toLowerCase();
    if ((l.refs !== '') || msg.match(/^[0-99].[0-99].[0-99]/)) {
      const dt = moment(l.date).format('YYYY/MM/DD');
      let ver = msg.match(/[0-99].[0-99].[0-99]/) ? msg : l.refs;
      ver = ver.replace('tag: v', '').replace('tag: ', 'release: ').split(',')[0];
      const heading = `\n### **${ver}** ${dt} ${l.author_email}\n\n`;
      if (!headings.includes(heading) && !ver.startsWith('tag')) {
        headings.push(heading);
        text += heading;
      }
    } else if ((msg.length > 2) && !msg.startsWith('update') && (previous !== msg)) {
      previous = msg;
      text += `- ${msg}\n`;
    }
  }

  try {
    const name = path.join(__dirname, f);
    fs.writeFileSync(name, text);
    logger.state('Change log updated:', name);
  } catch (err) {
    logger.state('Change log update error:', f, err);
  }
}

exports.update = update;

try {
  if (require.main === module) {
    update('../CHANGELOG.md');
  }
} catch {
  //
}
