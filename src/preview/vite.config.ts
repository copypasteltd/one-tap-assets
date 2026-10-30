import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({base:'./',root:resolve('src/preview'),publicDir:resolve('docs/media/demo'),cacheDir:resolve('runtime/vite-preview-cache'),
  resolve:{alias:[{find:/^@tarojs\/components$/,replacement:resolve('src/preview/components.tsx')},
    {find:/^@tarojs\/taro$/,replacement:resolve('src/preview/taro.ts')}]},
  define:{__YPCC_API_BASE__:JSON.stringify('https://preview.invalid')},
  server:{host:'127.0.0.1',port:4173,strictPort:true},
  build:{outDir:resolve('runtime/build/preview'),emptyOutDir:true,rollupOptions:{input:{index:resolve('src/preview/index.html'),support:resolve('src/preview/support.html'),review:resolve('src/preview/review.html'),metrics:resolve('src/preview/metrics.html'),plus:resolve('src/preview/plus.html')}}}});
