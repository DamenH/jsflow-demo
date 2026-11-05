const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const cases = [
  ['01-private-computation.js', 0, ["'42'_<T>", 'PUBLIC: Computation completed']],
  ['02-direct-disclosure.js', 1, ['SecurityError', 'publicOutput:']],
  ['03-transformed-disclosure.js', 1, ['SecurityError', 'publicOutput:']],
  ['04-implicit-disclosure.js', 1, ['SecurityError', 'publicOutput:']],
  ['05-sensitive-upgrade.js', 1, ['SecurityError', 'security context <T> not below existing value label <>']],
  ['06-prelabeled-computation.js', 0, ["'1'_<T>", 'PUBLIC: Computation completed']],
  ['07-public-output.js', 0, ['PUBLIC: Hello, public world']]
];
const selected = process.argv[2];
if (selected && selected !== 'suite') {
  const filename = path.resolve('/demo/examples', selected);
  const child = spawnSync(process.execPath, ['/demo/monitor.js', filename], { stdio: 'inherit', timeout: 10000 });
  if (child.error) console.error(child.error.message);
  process.exit(child.status === null ? 1 : child.status);
}
let failures = 0;
for (const [name, status, fragments] of cases) {
  const child = spawnSync(process.execPath, ['/demo/monitor.js', '/demo/examples/' + name], { encoding: 'utf8', timeout: 10000 });
  const output = child.stdout + child.stderr;
  const ok = child.status === status && fragments.every(fragment => output.includes(fragment)) &&
    (status === 0 || !output.includes('PUBLIC:'));
  console.log('\n=== ' + name + ' ===');
  console.log(fs.readFileSync('/demo/examples/' + name, 'utf8').trim());
  console.log('--- actual output (exit ' + child.status + ') ---');
  process.stdout.write(output);
  if (child.error) console.error(child.error.message);
  console.log(ok ? 'PASS (expected outcome)' : 'FAIL');
  if (!ok) failures++;
}
console.log('\n' + (cases.length - failures) + '/' + cases.length + ' expected outcomes verified.');
process.exitCode = failures ? 1 : 0;
