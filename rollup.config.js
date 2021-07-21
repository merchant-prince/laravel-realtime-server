import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

const config = [
  {
    input: './src/index.ts',
    output: {
      file: './dist/realtime.js',
      format: 'esm',
    },
    plugins: [
      typescript({ tsconfig: './tsconfig.json' }),
    ],
  },
  {
    input: './dist/types/src/index.d.ts',
    output: {
      file: './dist/realtime.d.ts',
      format: 'esm',
    },
    plugins: [
      dts(),
    ],
  },
];

export default config;
