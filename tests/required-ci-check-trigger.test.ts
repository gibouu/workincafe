import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('required CI check trigger', () => {
  it('runs the verify job for every pull request', () => {
    const workflow = readFileSync(
      join(process.cwd(), '.github', 'workflows', 'ci.yml'),
      'utf8',
    );
    const pullRequestTrigger = workflow.match(
      /^  pull_request:\n(?<configuration>(?: {4}.*\n)*)/m,
    );

    expect(pullRequestTrigger).not.toBeNull();
    expect(pullRequestTrigger?.groups?.configuration ?? '').not.toContain('paths-ignore');
  });
});
