import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// @ resolves to ./src/ in both dev and production mode
  // @/xxx.css

export default (env, argv) => {
  const isDevelopment = argv.mode !== 'production';
  // package.json: "dev": "webpack serve"
  // package.json: "build": "webpack --mode=production"

  return {
    entry: './main.jsx',
    mode: argv.mode || 'development',
    output: {
      path: path.resolve(__dirname, 'build'),
      filename: 'bundle.js',
      // use different publicPath for dev vs production
      publicPath: isDevelopment ? '/' : '/home/',
    },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 0,
              url: {
                filter: (url, resourcePath) => {
                  // Allow all URLs to be processed
                  return true;
                },
              },
              import: {
                filter: (url, media, resourcePath) => {
                  // Allow all imports to be processed
                  return true;
                },
              },
              modules: false,
              sourceMap: false,
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.css'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Ensure single React instance
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    modules: [
      'node_modules',
      path.resolve(__dirname, 'src'),
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
  ],
  devServer: {
    static: {
      directory: path.resolve(__dirname),
      publicPath: '/',
    },
    port: 5179,
    open: false,
    historyApiFallback: {
      index: '/index.html',
      disableDotRule: true,
    },
    hot: true,
  },
  };
};