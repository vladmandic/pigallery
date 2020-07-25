#!/usr/bin/env node

/* eslint-disable global-require */
/* eslint-disable import/no-extraneous-dependencies */

const fs = require('fs');
const proc = require('child_process');
const process = require('process');

let npm = {};

async function exec(cmd, msg) {
  return new Promise((resolve) => {
    if (msg) process.stdout.write(`Running: ${msg} ...`);
    const t0 = process.hrtime.bigint();
    proc.exec(cmd, (err, stdout, stderr) => {
      // if (err) process.stdout.write(`${err}\n`);
      let json = {};
      try {
        json = JSON.parse(`${stdout}${stderr}`);
      } catch { /**/ }
      const t1 = process.hrtime.bigint();
      const ms = Math.trunc(parseFloat(t1 - t0) / 1000000);
      if (msg) process.stdout.write(`\r${msg} completed in ${ms.toLocaleString()}ms\n`);
      resolve(json);
    });
  });
}

async function dependencyCheck() {
  process.stdout.write('Running: Dependency check ...');
  // eslint-disable-next-line node/no-unpublished-require
  const depcheck = require('depcheck');
  const options = {
    ignoreBinPackage: false, // ignore the packages with bin entry
    skipMissing: false, // skip calculation of missing dependencies
    ignoreDirs: [],
    ignoreMatches: ['htmlhint', 'minify', 'chart.js', 'eslint-plugin-*'],
    // parsers: { '*.js': depcheck.parser.es6 },
    detectors: [depcheck.detector.requireCallExpression, depcheck.detector.importDeclaration],
    specials: [depcheck.special.eslint],
  };
  return new Promise((resolve) => {
    depcheck(process.cwd(), options, (res) => {
      npm.depcheck = res;
      process.stdout.write(`\rDependency check: Unused={${res.dependencies}${res.devDependencies}} Missing=${JSON.stringify(res.missing)}\n`);
      resolve(true);
    });
  });
}

async function auditCheck() {
  npm.auditjs = await exec('./node_modules/.bin/auditjs ossi --quiet --json', 'OSSI audit check');
  for (const pkg of npm.auditjs) {
    process.stdout.write(`OSSI vulnerability in ${pkg.coordinates}\n`);
  }
}

async function deleteExamples() {
  await exec('find node_modules -type d -name "example*" -exec rm -rf {} \\; 2>/dev/null', 'Deleting module samples');
}

async function main() {
  process.stdout.write('Starting Setup\n');
  const f = './setup.json';
  if (!fs.existsSync('./package.json')) {
    process.stdout.write('Not a project home');
    process.exit(1);
  }

  const p = JSON.parse(fs.readFileSync('./package.json'));
  process.stdout.write(`${p.name} server v${p.version}\n`);
  process.stdout.write(`Platform=${process.platform} Arch=${process.arch} Node=${process.version}\n`);
  process.stdout.write('Project dependencies\n');
  process.stdout.write(` production: ${Object.keys(p.dependencies || {}).length}\n`);
  process.stdout.write(` development: ${Object.keys(p.devDependencies || {}).length}\n`);
  process.stdout.write(` optional: ${Object.keys(p.optionalDependencies || {}).length}\n`);
  if (fs.existsSync(f)) npm = JSON.parse(fs.readFileSync(f));

  // npm install
  npm.installProd = await exec('npm install --only=prod --json', 'NPM install production modules');
  npm.installDev = await exec('npm install --only=dev --json', 'NPM install development modules');
  npm.installOpt = await exec('npm install --only=opt --json', 'NPM install optional modules');

  // ncu upgrade
  process.stdout.write('Skipping NCU force upgrade modules\n');
  // eslint-disable-next-line node/no-unpublished-require
  // const ncu = require('npm-check-updates'); // eariliest we can load it
  // npm.ncu = await ncu.run({ jsonUpgraded: true, upgrade: true, packageManager: 'npm', silent: true });

  // npm optimize
  npm.update = await exec('npm update --depth=5 --json', 'NPM update modules');
  npm.dedupe = await exec('npm dedupe --json', 'NPM deduplicate modules');
  npm.prune = await exec('npm prune --no-production --json', 'NPM prune unused modules');
  npm.audit = await exec('npm audit fix --json', 'NPM audit modules');

  // delete examples
  await deleteExamples();

  // npm analyze
  npm.outdated = await exec('npm outdated --depth=5 --json', 'NPM outdated check');
  process.stdout.write(`NPM indirect outdated modules: ${Object.keys(npm.outdated).length}\n`);
  npm.ls = await exec('npm ls --json', 'NPM list full');
  const meta = npm.prune.audit.metadata;
  process.stdout.write(`Total dependencies: production=${meta.dependencies} development=${meta.devDependencies} optional=${meta.optionalDependencies}\n`);

  // 3rd party checks
  await dependencyCheck();
  await auditCheck();

  // npm.cache = await exec('npm cache verify', 'NPM verify cache');

  process.stdout.write('Results written to setup.json\n');
  let old = [];
  if (fs.existsSync(f)) old = JSON.parse(fs.readFileSync(f));
  old.push(npm);
  fs.writeFileSync(f, JSON.stringify(npm, null, 2));
}

main();

/*
#!/bin/bash
echo updating javascripts
mv scripts backup
mkdir scripts
cd scripts
curl -L https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css >bootstrap.css
curl -L https://cdn.jsdelivr.net/npm/chart.js@latest >chart.js
curl -L http://hammerjs.github.io/dist/hammer.min.js >hammer.js
curl -L https://code.jquery.com/jquery-3.5.0.min.js >jquery.js
curl -L https://moment.github.io/luxon/global/luxon.min.js >luxon.js
curl -L https://momentjs.com/downloads/moment.min.js >moment.js
curl -L https://unpkg.com/@popperjs/core@latest >popper.js
curl -L https://unpkg.com/superagent@latest >superagent.js
curl -L https://omnipotent.net/jquery.sparkline/2.1.2/jquery.sparkline.min.js >sparkline.js
curl -L https://unpkg.com/suncalc@latest >suncalc-full.js
curl -L https://www.chartjs.org/chartjs-chart-financial/chartjs-chart-financial.js >chart-financial-full.js
../node_modules/.bin/minify chart-financial-full.js >chart-financial.js
rm chart-financial-full.js
../node_modules/.bin/minify suncalc-full.js >suncalc.js
rm suncalc-full.js
curl -L https://raw.githubusercontent.com/maxdow/skycons/master/skycons.js >skycons-full.js
../node_modules/.bin/minify skycons-full.js >skycons.js
rm skycons-full.js
cp ../backup/prism.js .
cp ../backup/prism.css .
cp ../backup/sorttable.js .
cd ..

# prism: dynamically generated js and css at
# https://prismjs.com/download.html#themes=prism-tomorrow&languages=markup+css+clike+javascript+bash+css-extras+diff+json+json5+julia+markdown&plugins=line-numbers+inline-color
*/
