const { resolve } = require('node:path');
const name = process.argv[2]; const platform = process.argv[3];
if (!['mini-alipay', 'mini-douyin'].includes(name) || !['alipay', 'tt'].includes(platform)) throw new Error('Invalid mini build target');
const CLI = require('@tarojs/cli/dist/cli').default;
process.argv = [process.execPath, __filename, 'build', '--type', platform, '--disable-global-config', '--no-check'];
new CLI(resolve(__dirname, '../src', name)).run().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
