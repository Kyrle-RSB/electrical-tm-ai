import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const required=['README.md','LICENSE','SECURITY.md','PRIVACY.md','CONTRIBUTING.md','package.json','pnpm-lock.yaml',
'apps/desktop/forge.config.ts','apps/desktop/vite.renderer.config.ts','apps/desktop/index.html',
'packages/persistence-sqlite/src/connection.ts','packages/domain/src/shared/money.ts',
'packages/backup/src/create-backup.ts','packages/backup/src/restore-backup.ts'];
const absent=required.filter(p=>!fs.existsSync(path.join(root,p)));
const versions=fs.readdirSync(path.join(root,'packages/persistence-sqlite/src/migrations')).filter(x=>/^\d{4}-.*\.sql$/.test(x)).sort();
if(versions.some((x,i)=>Number(x.slice(0,4))!==i+1))throw new Error('Migration versions are not contiguous');
const output={requiredFiles:required.length,missing:absent,migrations:versions,status:absent.length?'FAIL':'PASS',
  note:'Structural requirements only, not proof of native platform or financial acceptance.'};
console.log(JSON.stringify(output,null,2));if(absent.length)process.exitCode=1;
