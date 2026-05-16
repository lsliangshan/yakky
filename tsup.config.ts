import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    'add-command-cli': 'src/add-command-cli.ts',
    'query-command-cli': 'src/query-command-cli.ts',
    'run-command-cli': 'src/run-command-cli.ts',
    'share-command-cli': 'src/share-command-cli.ts',
    'delete-command-cli': 'src/delete-command-cli.ts',
    'edit-command-cli': 'src/edit-command-cli.ts',
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
