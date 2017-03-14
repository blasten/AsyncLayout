import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
  plugins: [
    nodeResolve({ jsnext: true, main: true }),
    babel()
  ]
};
