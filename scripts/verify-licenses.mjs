import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const license=fs.readFileSync(path.join(root,'LICENSE'),'utf8');
if(!/MIT License/.test(license)||!/(Permission is hereby granted|permission is hereby granted)/.test(license))throw new Error('Expected MIT license text');
const rootPkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const appPkg=JSON.parse(fs.readFileSync(path.join(root,'apps/desktop/package.json'),'utf8'));
if(rootPkg.license!=='MIT'||appPkg.license!=='MIT')throw new Error('Repository/package license mismatch');
for(const [label,pkg] of [['root',rootPkg],['desktop',appPkg]])for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})){
 if(!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version))throw new Error(`${label}: ${name} must have exact pinned version`);
}
console.log('PASS: project MIT text, manifest licenses, and exact dependency version pins.');
console.log('NOTICE: third-party license review remains required in an installed dependency environment before public release.');
