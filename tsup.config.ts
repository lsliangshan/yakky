import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  target: 'node22',
  dts: false,
  sourcemap: true,
  clean: true,
  minify: false,
  shims: true,
});
