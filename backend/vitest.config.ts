import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    // Tests run with no credentials on purpose: the property under test is
    // that an unconfigured backend reports its limits instead of faking data.
    env: { NODE_ENV: 'test' },
  },
});
