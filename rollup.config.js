import typescript from '@rollup/plugin-typescript';

export default {
  input: './src/index.ts',
  output: {
    file: './dist/realtime-server.js',
    format: 'esm',
  },
  plugins: [
    typescript(),
  ],
};
