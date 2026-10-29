const path = require('node:path');
const { buildRoot } = require('./build-output.cjs');
const { createRequire } = require('node:module');
const CssMinimizerPlugin = createRequire(require.resolve('@tarojs/webpack5-runner'))('css-minimizer-webpack-plugin');
module.exports = function miniConfig(platform) {
  const root = path.resolve(__dirname, '..');
  return {
    projectName: '一品成片', date: '2026-10-27', designWidth: 375, deviceRatio: { 375: 2, 750: 1 }, sourceRoot: '.',
    outputRoot: path.join(buildRoot(), platform === 'alipay' ? 'mini-alipay' : 'mini-douyin'),
    framework: 'react', compiler: { type: 'webpack5', prebundle: { enable: false } }, cache: { enable: false },
    plugins: [],
    defineConstants: { __YPCC_API_BASE__: JSON.stringify(process.env.TARO_APP_API_BASE || ''),
      __YPCC_DOUYIN_TRADE_CONTRACT__: JSON.stringify(process.env.TARO_APP_DOUYIN_TRADE_CONTRACT || '') },
    mini: { compile: { include: [path.join(root, 'src/shared')] },
      webpackChain(chain) {
        chain.cache(false); chain.resolve.set('extensionAlias', { '.js': ['.ts', '.tsx', '.js'] });
        // Keep native Windows builds in one process instead of spawning one
        // minifier worker per reported CPU. Output/minification rules stay set.
        if (chain.optimization.minimizers.has('terserPlugin')) chain.optimization.minimizer('terserPlugin').tap(args => { args[0].parallel = false; return args; });
        // Taro's "csso" slot defaults to cssnano. Use the installed CSSO
        // compressor in-process and preserve rule order on this Windows host.
        chain.optimization.minimizer('cssoWebpackPlugin').tap(args => {
          args[0].parallel = false; args[0].minify = CssMinimizerPlugin.cssoMinify;
          args[0].minimizerOptions = { restructure: false }; return args;
        });
        chain.module.rule('script').use('babelLoader').tap(options => ({ ...options, configFile: path.join(root, 'src', platform === 'alipay' ? 'mini-alipay' : 'mini-douyin', 'babel.config.js') }));
      },
      postcss: { pxtransform: { enable: true, config: { designWidth: 375 } }, url: { enable: true, config: { limit: 1024 } } } },
  };
};
