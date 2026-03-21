/**
 * Base webpack config used across other specific configs
 */

import webpack from 'webpack';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import path from 'path';

const configuration: webpack.Configuration = {
  externals: [],

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            // Dev startup favors fast transpilation over blocking on stale type caches.
            transpileOnly: true,
            compilerOptions: {
              module: 'esnext',
            },
          },
        },
      },
    ],
  },

  output: {

    path: path.join(__dirname, '../build'),
    // https://github.com/webpack/webpack/issues/1114
    library: {
      type: 'commonjs2',
    },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    plugins: [
      new TsconfigPathsPlugins(),
    ],
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
    }),
  ],

};

export default configuration;
