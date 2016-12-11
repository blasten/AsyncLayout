import babel from 'rollup-plugin-babel';

export default {
  entry: 'src/ListView.js',
  plugins: [
    babel({
      exclude: 'node_modules/**'
    })
  ],
  dest: 'ListView.js'
};
