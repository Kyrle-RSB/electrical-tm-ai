import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
const config:ForgeConfig={
  packagerConfig:{
    asar:true,
    name:'ElectricalTMCockpit',
    executableName:'electrical-tm',
    extraResource:['../../packages/persistence-sqlite/src/migrations']
  },
  makers:[{name:'@electron-forge/maker-zip',platforms:['darwin','win32'],config:{}}],
  plugins:[new VitePlugin({
    build:[
      {entry:{main:'src/main/index.ts'},config:'vite.main.config.ts',target:'main'},
      {entry:{preload:'src/preload/index.ts'},config:'vite.preload.config.ts',target:'preload'}
    ],
    renderer:[{name:'main_window',config:'vite.renderer.config.ts'}]
  })]
};
export default config;
