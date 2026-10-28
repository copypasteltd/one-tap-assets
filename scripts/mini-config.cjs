const path = require('node:path');
module.exports = function miniConfig(platform) {
  const root = path.resolve(__dirname, '..');
  return {
    projectName: '一品成片', date: '2026-10-27', designWidth: 375, deviceRatio: { 375: 2, 750: 1 }, sourceRoot: '.',
    outputRoot: path.join(root, 'runtime/build', platform === 'alipay' ? 'mini-alipay' : 'mini-douyin'),
    framework: 'react', compiler: { type: 'webpack5', prebundle: { enable: false } }, cache: { enable: false },
    plugins: [],
    defineConstants: { __YPCC_API_BASE__: JSON.stringify(process.env.TARO_APP_API_BASE || ''),
      __YPCC_DOUYIN_TRADE_CONTRACT__: JSON.stringify(process.env.TARO_APP_DOUYIN_TRADE_CONTRACT || '') },
    mini: { compile: { include: [path.join(root, 'src/shared')] },
      webpackChain(chain) {
        chain.cache(false); chain.resolve.set('extensionAlias', { '.js': ['.ts', '.tsx', '.js'] });
        chain.module.rule('script').use('babelLoader').tap(options => ({ ...options, configFile: path.join(root, 'src', platform === 'alipay' ? 'mini-alipay' : 'mini-douyin', 'babel.config.js') }));
      },
      postcss: { pxtransform: { enable: true, config: { designWidth: 375 } }, url: { enable: true, config: { limit: 1024 } } } },
  };
};
