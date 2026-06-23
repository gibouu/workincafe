import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('admin ownership claims page', () => {
  it('gates the sensitive claims queue behind the server-side admin checks', () => {
    const source = readFileSync(
      join(process.cwd(), 'app', 'admin', 'ownership-claims', 'page.tsx'),
      'utf8',
    );

    expect(source).toContain("import { createAdminClient } from '@/lib/supabase/admin'");
    expect(source).toContain("import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist'");
    expect(source).toContain('supabase.auth.getUser()');
    expect(source).toContain('isEmailAllowlisted(user.email)');
    expect(source).toContain(".select('is_admin')");
    expect(source).toContain('if (!me?.is_admin) return []');
    expect(source).toMatch(/const\s+admin\s*=\s*createAdminClient\(\)[\s\S]+admin\s*\n\s*\.from\('place_claims'\)/);
  });
});
