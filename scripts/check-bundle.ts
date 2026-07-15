import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  compareBundleStats,
  readRouteBundleStats,
  type BundleBudgets,
} from './lib/bundle-stats';

interface BundleBaselineEntry {
  uncompressedBytes: number;
  gzipBytes: number;
}

type BundleBaseline = Record<string, BundleBaselineEntry>;

const mode = process.argv[2];
const projectRoot = process.cwd();

if (mode === '--report') {
  const baseline = JSON.parse(
    readFileSync(resolve(projectRoot, 'config/bundle-baseline.json'), 'utf8'),
  ) as BundleBaseline;
  const stats = readRouteBundleStats(projectRoot);
  const report = Object.fromEntries(
    stats
      .filter((stat) => stat.route in baseline)
      .map((stat) => [
        stat.route,
        {
          uncompressedBytes: stat.uncompressedBytes,
          gzipBytes: stat.gzipBytes,
        },
      ]),
  );

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else if (mode === '--check') {
  const budgets = JSON.parse(
    readFileSync(resolve(projectRoot, 'config/bundle-budgets.json'), 'utf8'),
  ) as BundleBudgets;
  const failures = compareBundleStats(readRouteBundleStats(projectRoot), budgets);

  if (failures.length === 0) {
    process.stdout.write('Bundle budgets passed.\n');
  } else {
    process.stderr.write('Bundle budget failures:\n');
    for (const failure of failures) {
      process.stderr.write(
        `- ${failure.route} ${failure.metric}: ${failure.actual} bytes (limit ${failure.limit})\n`,
      );
    }
    process.exitCode = 1;
  }
} else {
  process.stderr.write('Usage: tsx scripts/check-bundle.ts <--report|--check>\n');
  process.exitCode = 1;
}
