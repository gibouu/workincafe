import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ReviewForm photo upload errors', () => {
  it('throws photo upload and persistence failures into the submit error flow', () => {
    const source = readFileSync(
      join(process.cwd(), 'components', 'review', 'ReviewForm.tsx'),
      'utf8',
    );

    expect(source).toContain("throw new Error('Photo upload could not be authorized')");
    expect(source).toContain("throw new Error('Photo upload failed')");
    expect(source).toContain("throw new Error(body.error ?? 'Photo upload could not be saved')");
    expect(source).toContain('const persistResp = await fetch(`/api/reviews/${reviewId}/photos`, {');
    expect(source).toContain('if (!persistResp.ok) {');
    expect(source).toContain("setSubmitError(err instanceof Error ? err.message : 'Submit failed')");
  });
});
