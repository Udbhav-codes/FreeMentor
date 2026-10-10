import { defineConfig } from 'vitest/config';

export default defineConfig({
  // React Native defines __DEV__; Node does not. Declaring it here lets app
  // code use the bare identifier, which Metro replaces with a literal in a
  // release build so dead branches are eliminated rather than merely
  // unreachable.
  define: { __DEV__: 'true' },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
