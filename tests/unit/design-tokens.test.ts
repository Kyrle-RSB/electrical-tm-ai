import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {colorTokens,contrastPairs,radii,scalePropertyNames,shadows,spaceSteps,statuses,textSizes,themedPropertyNames,token} from '../../apps/desktop/src/renderer/theme/tokens';
import {contrastRatio,parseHexColor,relativeLuminance} from '../../apps/desktop/src/renderer/theme/contrast';

const renderer=path.join(process.cwd(),'apps/desktop/src/renderer');
const read=(p:string)=>fs.readFileSync(path.join(renderer,p),'utf8');
const css=read('theme/tokens.css');

/** Custom properties declared in the block whose selector list is exactly `selector`. */
function block(source:string,selector:string):Map<string,string>{
 // Comments and @media overrides are not theme blocks.
 const stripped=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@media[^{]*\{[^{}]*\{[^{}]*\}\s*\}/g,'');
 const found=[...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].trim()===selector);
 assert.equal(found.length,1,`expected one ${selector} block`);
 return new Map([...found[0][2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
}
const scales=block(css,':root');
const themes={light:block(css,':root,[data-theme="light"]'),dark:block(css,'[data-theme="dark"]')};

test('every typed token name exists in tokens.css, in both themes',()=>{
 for(const name of scalePropertyNames)assert.ok(scales.has(name),`${name} missing from :root`);
 for(const [theme,values] of Object.entries(themes)){
  for(const name of themedPropertyNames)assert.ok(values.has(name),`${name} missing from ${theme}`);
  assert.deepEqual([...values.keys()].sort(),[...themedPropertyNames].sort(),`${theme} defines exactly the typed names`);
 }
 assert.equal(token.color.accent,'var(--tm-color-accent)');
 assert.equal(token.status.overdue.bg,'var(--tm-status-overdue-bg)');
 assert.equal(token.space['2-5'],'var(--tm-space-2-5)');
});

test('theme colours are plain #rrggbb so contrast is exact and measurable',()=>{
 for(const values of Object.values(themes))for(const [name,value] of values){
  if(name.startsWith('--tm-color-')||name.startsWith('--tm-status-'))assert.doesNotThrow(()=>parseHexColor(value),name);
 }
});

test('WCAG contrast maths matches known reference values',()=>{
 assert.equal(relativeLuminance('#ffffff'),1);
 assert.equal(relativeLuminance('#000000'),0);
 assert.equal(contrastRatio('#000000','#ffffff'),21);
 assert.equal(contrastRatio('#777777','#ffffff').toFixed(2),'4.48');
 assert.equal(contrastRatio('#ffffff','#767676').toFixed(2),'4.54');
 assert.throws(()=>parseHexColor('#fff'));
 assert.throws(()=>parseHexColor('rgb(0,0,0)'));
});

test('every listed text and control pair passes WCAG AA in light and dark',()=>{
 assert.ok(contrastPairs.length>=30);
 const failures:string[]=[];
 for(const [theme,values] of Object.entries(themes))for(const pair of contrastPairs){
  const fg=values.get(pair.fg),bg=values.get(pair.bg);
  assert.ok(fg&&bg,`${theme}: ${pair.use} names unknown tokens`);
  const ratio=contrastRatio(fg,bg);
  if(ratio<pair.min)failures.push(`${theme}: ${pair.use} ${ratio.toFixed(2)} < ${pair.min}`);
 }
 assert.deepEqual(failures,[]);
});

test('six document statuses each have a distinct colour in each theme',()=>{
 assert.deepEqual([...statuses],['draft','sent','paid','overdue','signed','locked']);
 for(const values of Object.values(themes)){
  const pairs=statuses.map(s=>values.get(`--tm-status-${s}-fg`)+'/'+values.get(`--tm-status-${s}-bg`));
  assert.equal(new Set(pairs).size,statuses.length);
 }
});

test('reduced motion turns every duration to zero',()=>{
 const reduced=/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*:root\{([^}]*)\}/.exec(css);
 assert.ok(reduced,'reduced-motion block missing');
 for(const d of ['fast','base','slow'])assert.match(reduced[1],new RegExp(`--tm-duration-${d}:0ms`));
});

test('the font is bundled locally, with its licence, and nothing loads from the network',()=>{
 assert.match(css,/@font-face\{[^}]*font-family:'Inter';[^}]*src:url\('\.\/fonts\/InterVariable\.woff2'\) format\('woff2'\)/);
 const font=fs.readFileSync(path.join(renderer,'theme/fonts/InterVariable.woff2'));
 assert.equal(font.subarray(0,4).toString('latin1'),'wOF2');
 assert.match(read('theme/fonts/OFL.txt'),/SIL OPEN FONT LICENSE Version 1\.1/);
 for(const file of ['theme/tokens.css','theme/base.css','theme/screens.css','components/ui/components.css']){
  const source=read(file);
  assert.doesNotMatch(source,/https?:\/\/|@import/,`${file} must not load anything remote`);
  assert.doesNotMatch(source,/gradient\(|url\((?!'\.\/fonts\/)/,`${file}: solid colours only`);
 }
});

test('the components page has a style rule for every token it draws',()=>{
 const screens=read('theme/screens.css');
 for(const t of colorTokens)assert.match(screens,new RegExp(`\\.sw-${t}\\{background:var\\(--tm-color-${t}\\)\\}`));
 for(const s of textSizes)assert.match(screens,new RegExp(`\\.ds-text-${s}\\{font-size:var\\(--tm-text-${s}\\)\\}`));
 for(const s of spaceSteps)assert.match(screens,new RegExp(`\\.ds-space-${s}\\{width:var\\(--tm-space-${s}\\)\\}`));
 for(const s of radii)assert.match(screens,new RegExp(`\\.ds-radius-${s}\\{`));
 for(const s of shadows)assert.match(screens,new RegExp(`\\.ds-shadow-${s}\\{`));
});

test('renderer styles and components use tokens, not raw colours',()=>{
 const files=['theme/base.css','theme/screens.css','components/ui/components.css'];
 for(const file of files)assert.doesNotMatch(read(file),/#[0-9a-f]{3,8}\b|rgba?\(/i,`${file} has a raw colour`);
 const tsx:string[]=[];
 const walk=(dir:string)=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.tsx$/.test(e.name))tsx.push(p);}};
 walk(renderer);
 for(const file of tsx){
  const source=fs.readFileSync(file,'utf8');
  // The packaged CSP is style-src 'self': no inline style attributes anywhere.
  assert.doesNotMatch(source,/\bstyle=\{/,`${path.relative(renderer,file)} uses an inline style`);
  assert.doesNotMatch(source,/\u2014/,`${path.relative(renderer,file)} has an em dash`);
 }
});
