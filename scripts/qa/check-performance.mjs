import { readFileSync } from 'node:fs';
const budgets = JSON.parse(readFileSync(new URL('../../tests/fixtures/performance-budgets.json', import.meta.url)));
const report = JSON.parse(readFileSync(process.argv[2]));
let failures = 0;
for (const sample of report.samples) {
  const budget = budgets[sample.path];
  if (!budget) throw new Error(`Unbudgeted route: ${sample.path}`);
  for (const metric of ['jsBytes', 'readyMs', 'lcpMs']) {
    if (!Number.isFinite(sample[metric]) || sample[metric] <= 0 || sample[metric] > budget[metric]) {
      console.error(`FAIL ${sample.path} ${metric}: ${sample[metric]} (budget ${budget[metric]})`);
      failures++;
    }
  }
}
for (const path of Object.keys(budgets)) {
  if (!report.samples.some((sample) => sample.path === path)) throw new Error(`Missing measurement: ${path}`);
}
if (failures) process.exitCode = 1;
else console.log('PASS: all measured route budgets');
