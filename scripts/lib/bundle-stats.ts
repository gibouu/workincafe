import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

export interface RouteBundleStat {
  route: string;
  uncompressedBytes: number;
  gzipBytes: number;
  chunks: string[];
}

export type BundleBudgets = Record<string, { maxBytes: number; maxGzipBytes: number }>;

export interface BudgetFailure {
  route: string;
  metric: 'uncompressedBytes' | 'gzipBytes';
  actual: number;
  limit: number;
}

interface NextRouteBundleStat {
  route: string;
  firstLoadUncompressedJsBytes: number;
  firstLoadChunkPaths: string[];
}

export function readRouteBundleStats(projectRoot = process.cwd()): RouteBundleStat[] {
  const diagnosticsPath = resolve(
    projectRoot,
    '.next/diagnostics/route-bundle-stats.json',
  );
  const diagnostics = JSON.parse(
    readFileSync(diagnosticsPath, 'utf8'),
  ) as NextRouteBundleStat[];

  return diagnostics.map((stat) => ({
    route: stat.route,
    uncompressedBytes: stat.firstLoadUncompressedJsBytes,
    gzipBytes: stat.firstLoadChunkPaths.reduce((total, chunkPath) => {
      const contents = readFileSync(resolve(projectRoot, chunkPath));
      return total + gzipSync(contents).byteLength;
    }, 0),
    chunks: stat.firstLoadChunkPaths,
  }));
}

export function compareBundleStats(
  current: readonly RouteBundleStat[],
  budgets: BundleBudgets,
): BudgetFailure[] {
  for (const route of Object.keys(budgets)) {
    const measurementCount = current.filter((stat) => stat.route === route).length;
    if (measurementCount !== 1) {
      throw new Error(
        `Expected exactly one bundle measurement for route "${route}"; found ${measurementCount}.`,
      );
    }
  }

  return current.flatMap((stat) => {
    const budget = budgets[stat.route];
    if (!budget) return [];

    const failures: BudgetFailure[] = [];
    if (stat.uncompressedBytes > budget.maxBytes) {
      failures.push({
        route: stat.route,
        metric: 'uncompressedBytes',
        actual: stat.uncompressedBytes,
        limit: budget.maxBytes,
      });
    }
    if (stat.gzipBytes > budget.maxGzipBytes) {
      failures.push({
        route: stat.route,
        metric: 'gzipBytes',
        actual: stat.gzipBytes,
        limit: budget.maxGzipBytes,
      });
    }
    return failures;
  });
}
