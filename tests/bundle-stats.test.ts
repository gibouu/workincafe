import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compareBundleStats,
  readRouteBundleStats,
  type RouteBundleStat,
} from '@/scripts/lib/bundle-stats';

const temporaryDirectories: string[] = [];
const repositoryRoot = process.cwd();

function createCliFixture(prefix: string, routes = ['/']) {
  const projectRoot = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(projectRoot);
  mkdirSync(join(projectRoot, '.next/diagnostics'), { recursive: true });
  mkdirSync(join(projectRoot, '.next/static/chunks'), { recursive: true });
  mkdirSync(join(projectRoot, 'config'), { recursive: true });

  const chunk = '.next/static/chunks/root.js';
  const contents = 'const route = "/";\n';
  const uncompressedBytes = Buffer.byteLength(contents);
  const gzipBytes = gzipSync(contents).byteLength;
  writeFileSync(join(projectRoot, chunk), contents);
  writeFileSync(
    join(projectRoot, '.next/diagnostics/route-bundle-stats.json'),
    JSON.stringify(
      routes.map((route) => ({
        route,
        firstLoadUncompressedJsBytes: uncompressedBytes,
        firstLoadChunkPaths: [chunk],
      })),
    ),
  );

  return { projectRoot, uncompressedBytes, gzipBytes };
}

function runBundleCli(projectRoot: string, mode: '--report' | '--check') {
  return spawnSync(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      join(repositoryRoot, 'scripts/check-bundle.ts'),
      mode,
    ],
    { cwd: projectRoot, encoding: 'utf8' },
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('readRouteBundleStats', () => {
  it('computes route gzip totals from the emitted chunk files', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'bundle-stats-'));
    temporaryDirectories.push(projectRoot);
    mkdirSync(join(projectRoot, '.next/diagnostics'), { recursive: true });
    mkdirSync(join(projectRoot, '.next/static/chunks'), { recursive: true });

    const chunks = ['.next/static/chunks/framework.js', '.next/static/chunks/root.js'];
    const contents = ['const framework = "shared";\n', 'const route = "/";\n'];
    chunks.forEach((chunk, index) => writeFileSync(join(projectRoot, chunk), contents[index]));
    writeFileSync(
      join(projectRoot, '.next/diagnostics/route-bundle-stats.json'),
      JSON.stringify([
        {
          route: '/',
          firstLoadUncompressedJsBytes: contents.reduce(
            (total, content) => total + Buffer.byteLength(content),
            0,
          ),
          firstLoadChunkPaths: chunks,
        },
      ]),
    );

    expect(readRouteBundleStats(projectRoot)).toEqual([
      {
        route: '/',
        uncompressedBytes: contents.reduce(
          (total, content) => total + Buffer.byteLength(content),
          0,
        ),
        gzipBytes: contents.reduce(
          (total, content) => total + gzipSync(content).byteLength,
          0,
        ),
        chunks,
      },
    ]);
  });
});

describe('bundle stats CLI', () => {
  it('prints baseline-compatible measurements in report mode', () => {
    const { projectRoot, uncompressedBytes, gzipBytes } = createCliFixture('bundle-report-');
    writeFileSync(
      join(projectRoot, 'config/bundle-baseline.json'),
      JSON.stringify({ '/': { uncompressedBytes: 1, gzipBytes: 1 } }),
    );

    const result = runBundleCli(projectRoot, '--report');

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      '/': {
        uncompressedBytes,
        gzipBytes,
      },
    });
  });

  it('exits non-zero when a route exceeds its absolute budget', () => {
    const { projectRoot, uncompressedBytes, gzipBytes } = createCliFixture('bundle-check-');
    writeFileSync(
      join(projectRoot, 'config/bundle-budgets.json'),
      JSON.stringify({
        '/': { maxBytes: uncompressedBytes - 1, maxGzipBytes: gzipBytes },
      }),
    );

    const result = runBundleCli(projectRoot, '--check');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `/ uncompressedBytes: ${uncompressedBytes} bytes (limit ${uncompressedBytes - 1})`,
    );
  });

  it('exits non-zero when a configured route is missing from diagnostics', () => {
    const { projectRoot, uncompressedBytes, gzipBytes } = createCliFixture(
      'bundle-missing-',
      ['/other'],
    );
    writeFileSync(
      join(projectRoot, 'config/bundle-budgets.json'),
      JSON.stringify({
        '/': { maxBytes: uncompressedBytes, maxGzipBytes: gzipBytes },
      }),
    );

    const result = runBundleCli(projectRoot, '--check');

    expect(result.status).toBe(1);
    expect(result.stderr).toBe(
      'Expected exactly one bundle measurement for route "/"; found 0.\n',
    );
  });

  it('exits non-zero when a configured route is duplicated in diagnostics', () => {
    const { projectRoot, uncompressedBytes, gzipBytes } = createCliFixture(
      'bundle-duplicate-',
      ['/', '/'],
    );
    writeFileSync(
      join(projectRoot, 'config/bundle-budgets.json'),
      JSON.stringify({
        '/': { maxBytes: uncompressedBytes, maxGzipBytes: gzipBytes },
      }),
    );

    const result = runBundleCli(projectRoot, '--check');

    expect(result.status).toBe(1);
    expect(result.stderr).toBe(
      'Expected exactly one bundle measurement for route "/"; found 2.\n',
    );
  });
});

describe('bundle measurement configuration', () => {
  it('checks in the measured root baseline with a ten-percent regression ceiling', () => {
    const baselinePath = join(repositoryRoot, 'config/bundle-baseline.json');
    const budgetsPath = join(repositoryRoot, 'config/bundle-budgets.json');
    expect([existsSync(baselinePath), existsSync(budgetsPath)]).toEqual([true, true]);

    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const budgets = JSON.parse(readFileSync(budgetsPath, 'utf8'));
    expect(baseline).toEqual({
      '/': { uncompressedBytes: 8_284_854, gzipBytes: 1_907_701 },
    });
    expect(budgets).toEqual({
      '/': {
        maxBytes: Math.ceil(baseline['/'].uncompressedBytes * 1.1),
        maxGzipBytes: Math.ceil(baseline['/'].gzipBytes * 1.1),
      },
    });
  });

  it('runs the bundle check after the production build in CI', () => {
    const packageJson = JSON.parse(
      readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
    );
    const workflow = readFileSync(
      join(repositoryRoot, '.github/workflows/ci.yml'),
      'utf8',
    );

    expect(packageJson.scripts).toMatchObject({
      'bundle:report': 'tsx scripts/check-bundle.ts --report',
      'bundle:check': 'tsx scripts/check-bundle.ts --check',
    });
    expect(workflow).toMatch(
      /- run: npm run build\s+- run: npm run bundle:check/,
    );
  });
});

describe('compareBundleStats', () => {
  it('reports a root-route gzip regression above its absolute budget', () => {
    const current: RouteBundleStat[] = [
      { route: '/', uncompressedBytes: 3_000_000, gzipBytes: 910_000, chunks: ['root.js'] },
    ];

    expect(compareBundleStats(current, { '/': { maxBytes: 3_500_000, maxGzipBytes: 900_000 } }))
      .toEqual([{ route: '/', metric: 'gzipBytes', actual: 910_000, limit: 900_000 }]);
  });

  it('rejects a missing configured route measurement', () => {
    expect(() => compareBundleStats([], {
      '/': { maxBytes: 3_500_000, maxGzipBytes: 900_000 },
    })).toThrow('Expected exactly one bundle measurement for route "/"; found 0.');
  });

  it('rejects duplicate configured route measurements', () => {
    const duplicate: RouteBundleStat = {
      route: '/',
      uncompressedBytes: 3_000_000,
      gzipBytes: 800_000,
      chunks: ['root.js'],
    };

    expect(() => compareBundleStats([duplicate, duplicate], {
      '/': { maxBytes: 3_500_000, maxGzipBytes: 900_000 },
    })).toThrow('Expected exactly one bundle measurement for route "/"; found 2.');
  });
});
