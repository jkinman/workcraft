import { createRequire } from 'module';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('dashboard config', () => {
  it('resolves the career-ops repo root from the Next app directory', () => {
    delete require.cache[require.resolve('../config')];
    const config = require('../config');

    expect(config.CAREER_OPS_PATH).toBe(join(process.cwd(), '..'));
  });
});
