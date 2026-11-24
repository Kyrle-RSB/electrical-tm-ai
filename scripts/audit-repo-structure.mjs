import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {builtinModules} from 'node:module';
import ts from 'typescript';
/** Source ownership and import graph audit; catalog copied from owner's approved 239-path map. */
const root=path.resolve(import.meta.dirname,'..');
const canonical=new Set(["README.md", "LICENSE", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "PRIVACY.md", "SUPPORT.md", "CHANGELOG.md", ".editorconfig", ".gitattributes", ".gitignore", ".npmrc", ".prettierrc.json", "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "tsconfig.base.json", "eslint.config.mjs", "vitest.workspace.ts", ".github/ISSUE_TEMPLATE/bug_report.yml", ".github/ISSUE_TEMPLATE/feature_request.yml", ".github/PULL_REQUEST_TEMPLATE.md", ".github/CODEOWNERS", ".github/dependabot.yml", ".github/workflows/ci.yml", ".github/workflows/security.yml", ".github/workflows/package-macos.yml", ".github/workflows/package-windows.yml", ".github/workflows/release.yml", "apps/desktop/package.json", "apps/desktop/forge.config.ts", "apps/desktop/vite.main.config.ts", "apps/desktop/vite.preload.config.ts", "apps/desktop/vite.renderer.config.ts", "apps/desktop/assets/icon.icns", "apps/desktop/assets/icon.ico", "apps/desktop/src/main/index.ts", "apps/desktop/src/main/bootstrap.ts", "apps/desktop/src/main/window.ts", "apps/desktop/src/main/ipc/register.ts", "apps/desktop/src/main/ipc/sender-guard.ts", "apps/desktop/src/main/ipc/handlers/projects.ts", "apps/desktop/src/main/ipc/handlers/workers.ts", "apps/desktop/src/main/ipc/handlers/materials.ts", "apps/desktop/src/main/ipc/handlers/invoices.ts", "apps/desktop/src/main/ipc/handlers/payments.ts", "apps/desktop/src/main/ipc/handlers/overhead.ts", "apps/desktop/src/main/ipc/handlers/settings.ts", "apps/desktop/src/main/ipc/handlers/notifications.ts", "apps/desktop/src/main/ipc/handlers/ai-gmail.ts", "apps/desktop/src/main/ipc/handlers/backups.ts", "apps/desktop/src/main/os/file-dialogs.ts", "apps/desktop/src/main/os/paths.ts", "apps/desktop/src/main/os/keychain.ts", "apps/desktop/src/main/os/oauth-loopback.ts", "apps/desktop/src/main/os/clock.ts", "apps/desktop/src/main/os/single-instance.ts", "apps/desktop/src/preload/index.ts", "apps/desktop/src/preload/bridge.ts", "apps/desktop/src/preload/globals.d.ts", "apps/desktop/src/renderer/index.html", "apps/desktop/src/renderer/main.tsx", "apps/desktop/src/renderer/App.tsx", "apps/desktop/src/renderer/shell/CockpitShell.tsx", "apps/desktop/src/renderer/theme/tokens.css", "apps/desktop/src/renderer/theme/system-theme.ts", "apps/desktop/src/renderer/components/GlassCard.tsx", "apps/desktop/src/renderer/components/NotificationLightbox.tsx", "apps/desktop/src/renderer/features/projects/ProjectsPanel.tsx", "apps/desktop/src/renderer/features/workers/WorkersPanel.tsx", "apps/desktop/src/renderer/features/labor/LaborPanel.tsx", "apps/desktop/src/renderer/features/materials/ReceiptImportPanel.tsx", "apps/desktop/src/renderer/features/materials/DispositionSplitEditor.tsx", "apps/desktop/src/renderer/features/invoices/InvoiceEditor.tsx", "apps/desktop/src/renderer/features/invoices/InvoicePdfPreview.tsx", "apps/desktop/src/renderer/features/payments/PaymentRecorder.tsx", "apps/desktop/src/renderer/features/payments/ReceiptDraftPanel.tsx", "apps/desktop/src/renderer/features/profitability/EstimatedProfitPanel.tsx", "apps/desktop/src/renderer/features/overhead/OverheadCalendar.tsx", "apps/desktop/src/renderer/features/settings/BusinessBranding.tsx", "apps/desktop/src/renderer/features/settings/BackupLocation.tsx", "apps/desktop/src/renderer/features/settings/GmailSetupWizard.tsx", "apps/desktop/src/renderer/features/settings/ClaudeSetupWizard.tsx", "apps/desktop/src/renderer/features/help/HelpDrawer.tsx", "packages/contracts/src/index.ts", "packages/contracts/src/ipc/channel-map.ts", "packages/contracts/src/ipc/request-envelope.ts", "packages/contracts/src/ipc/error-envelope.ts", "packages/contracts/src/ipc/projects.contract.ts", "packages/contracts/src/ipc/materials.contract.ts", "packages/contracts/src/ipc/invoices.contract.ts", "packages/contracts/src/ipc/payments.contract.ts", "packages/contracts/src/ipc/overhead.contract.ts", "packages/contracts/src/ipc/settings.contract.ts", "packages/contracts/src/schemas/money.schema.ts", "packages/contracts/src/schemas/quantity.schema.ts", "packages/contracts/src/schemas/identity.schema.ts", "packages/domain/src/index.ts", "packages/domain/src/shared/money.ts", "packages/domain/src/shared/quantity.ts", "packages/domain/src/shared/ids.ts", "packages/domain/src/shared/clock.ts", "packages/domain/src/labor/rate-snapshots.ts", "packages/domain/src/labor/labor-calculations.ts", "packages/domain/src/materials/cost-basis.ts", "packages/domain/src/materials/disposition-splits.ts", "packages/domain/src/materials/markup.ts", "packages/domain/src/invoices/invoice-finalization.ts", "packages/domain/src/invoices/invoice-allocation.ts", "packages/domain/src/invoices/tax-rounding.ts", "packages/domain/src/invoices/invoice-state.ts", "packages/domain/src/credits/credit-note-policy.ts", "packages/domain/src/payments/payment-ledger.ts", "packages/domain/src/payments/payment-receipts.ts", "packages/domain/src/profitability/estimated-profit.ts", "packages/domain/src/overhead/daily-overhead.ts", "packages/domain/src/overhead/allocation.ts", "packages/domain/src/notifications/reminder-calendar.ts", "packages/application/src/index.ts", "packages/application/src/ports/port-types.ts", "packages/application/src/use-cases/projects.ts", "packages/application/src/use-cases/labor.ts", "packages/application/src/use-cases/materials.ts", "packages/application/src/use-cases/invoice-lifecycle.ts", "packages/application/src/use-cases/payments.ts", "packages/application/src/use-cases/estimated-profit.ts", "packages/application/src/use-cases/overhead-calendar.ts", "packages/application/src/use-cases/reminders.ts", "packages/application/src/use-cases/gmail-drafts.ts", "packages/application/src/use-cases/ai-extraction.ts", "packages/application/src/use-cases/backup-restore.ts", "packages/application/src/use-cases/business-branding.ts", "packages/persistence-sqlite/src/connection.ts", "packages/persistence-sqlite/src/migrations/0001-initial.sql", "packages/persistence-sqlite/src/migrations/0002-material-dispositions.sql", "packages/persistence-sqlite/src/migrations/0003-overhead-profit.sql", "packages/persistence-sqlite/src/migrations/0004-payment-receipts-branding.sql", "packages/persistence-sqlite/src/repos/project-repo.ts", "packages/persistence-sqlite/src/repos/labor-repo.ts", "packages/persistence-sqlite/src/repos/materials-repo.ts", "packages/persistence-sqlite/src/repos/invoice-repo.ts", "packages/persistence-sqlite/src/repos/payment-repo.ts", "packages/persistence-sqlite/src/repos/overhead-repo.ts", "packages/persistence-sqlite/src/repos/asset-repo.ts", "packages/persistence-sqlite/src/transactions/unit-of-work.ts", "packages/asset-vault/src/import-file.ts", "packages/asset-vault/src/verify-image.ts", "packages/asset-vault/src/hash.ts", "packages/asset-vault/src/resolve-managed-asset.ts", "packages/asset-vault/src/sanitize-image.ts", "packages/pdf/src/invoices/invoice-template.ts", "packages/pdf/src/invoices/render-invoice.ts", "packages/pdf/src/payments/render-payment-receipt.ts", "packages/pdf/src/credits/render-credit-note.ts", "packages/pdf/src/common/branding.ts", "packages/pdf/src/common/format-money.ts", "packages/pdf/src/common/stored-pdf.ts", "packages/backup/src/create-backup.ts", "packages/backup/src/restore-backup.ts", "packages/backup/src/backup-manifest.ts", "packages/backup/src/backup-destination.ts", "packages/claude/src/claude-client.ts", "packages/claude/src/receipt-extractor.ts", "packages/claude/src/email-drafter.ts", "packages/claude/src/model-catalog.ts", "packages/claude/src/cost-tracker.ts", "packages/gmail/src/google-oauth.ts", "packages/gmail/src/gmail-client.ts", "packages/gmail/src/send-attempt.ts", "packages/gmail/src/mime-message.ts", "packages/gmail/src/token-lifecycle.ts", "packages/notifications/src/notification-engine.ts", "packages/notifications/src/dismiss-and-snooze.ts", "tests/fixtures/contractor-fictional.json", "tests/fixtures/receipts/synthetic-receipt.png", "tests/fixtures/receipts/synthetic-receipt.pdf", "tests/fixtures/materials/split-cases.json", "tests/fixtures/profitability/overhead-oracles.json", "tests/fixtures/payments/payment-oracles.json", "tests/unit/money.test.ts", "tests/unit/materials-dispositions.test.ts", "tests/unit/overhead-allocation.test.ts", "tests/unit/estimated-profit.test.ts", "tests/unit/payment-ledger.test.ts", "tests/integration/sqlite-ledger.test.ts", "tests/integration/invoice-immutability.test.ts", "tests/integration/payment-receipt.test.ts", "tests/integration/backup-restore.test.ts", "tests/integration/claude-fake.test.ts", "tests/integration/gmail-fake.test.ts", "tests/security/ipc-security.test.ts", "tests/security/asset-import.test.ts", "tests/security/no-secret-leak.test.ts", "tests/e2e/cockpit-flow.spec.ts", "tests/e2e/material-split.spec.ts", "tests/e2e/overhead-calendar.spec.ts", "tests/e2e/invoice-payment-receipt.spec.ts", "tests/platform/macos-install.md", "tests/platform/windows-install.md", "docs/architecture/overview.md", "docs/architecture/data-model.md", "docs/architecture/finance.md", "docs/architecture/ipc-contracts.md", "docs/architecture/threat-model.md", "docs/architecture/adr/0001-electron-runtime.md", "docs/architecture/adr/0002-money-and-quantity.md", "docs/architecture/adr/0003-overhead-allocation.md", "docs/architecture/adr/0004-payment-receipts.md", "docs/architecture/adr/0005-asset-branding.md", "docs/architecture/adr/0006-material-dispositions.md", "docs/architecture/adr/0007-gmail-oauth.md", "docs/architecture/adr/0008-backups.md", "docs/architecture/adr/0009-desktop-distribution.md", "docs/user/00-start-here.md", "docs/user/install-macos.md", "docs/user/install-windows.md", "docs/user/projects-labor.md", "docs/user/materials-and-splits.md", "docs/user/estimated-profit-overhead.md", "docs/user/invoices-and-credit-notes.md", "docs/user/partial-full-payments.md", "docs/user/integrations/claude-setup.md", "docs/user/integrations/gmail-setup.md", "docs/user/backups-restore.md", "docs/user/privacy-secrets.md", "docs/user/troubleshooting.md", "docs/testing/acceptance-matrix.md", "docs/testing/clean-machine-install.md", "docs/testing/security-and-financial-tests.md", "docs/build-journal/README.md", "docs/build-journal/prompt-log.md", "docs/build-journal/iteration-template.md", "docs/releases/RELEASE-CHECKLIST.md", "scripts/audit-repo-structure.mjs", "scripts/audit-source-secrets.mjs", "scripts/audit-requirements.mjs", "scripts/verify-licenses.mjs", "scripts/make-fixtures.mjs", "scripts/run-packaged-smoke.mjs"]);
// ADR-P2-001 is an explicit one-for-one entry-point exception, not a new module.
canonical.delete('apps/desktop/src/renderer/index.html');canonical.add('apps/desktop/index.html');
// Existing supporting test/config/evidence paths in the native-verified baseline;
// these are not additions to the approved application-module catalog.
const supplemental=new Set([
 '.github/workflows/codeql.yml','.nvmrc','apps/desktop/tsconfig.json',
 'docs/phase-1/evidence/README.md','docs/phase-1/evidence/REPAIR_SESSION_2026-11-23.md',
 'docs/public-repo/REPOSITORY_STANDARDS.md','packages/persistence-sqlite/src/migrations/0005-evidence-integrity.sql',
 'packages/persistence-sqlite/src/migrations/0006-operation-receipts.sql',
 'packages/persistence-sqlite/src/migrations/0007-business-logo.sql',
 'scripts/audit-native-proof.mjs','scripts/capture-native-proof.mjs','scripts/run-foundation-tests.mjs',
 'tests/fixtures/synthetic-receipt.png','tests/foundation/foundation.test.ts','tests/integration/backup-location.test.ts',
 'tests/integration/financial-evidence-locks.test.ts','tests/integration/migration-rescue.test.ts','tests/integration/operation-queue.test.ts',
 'tests/integration/pdf-storage.test.ts','tests/integration/project-crud.test.ts','tests/integration/startup-evidence.test.ts',
 'tests/security/ipc-error-envelope.test.ts','tests/unit/quantity.test.ts','tests/unit/rate-snapshots.test.ts','tsconfig.probe.json'
]);
const ignored=new Set(['node_modules','dist-probe','.vite','.git','out','coverage','dist','.local-evidence']);
const discovered=[];
function visit(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
 const abs=path.join(folder,entry.name),rel=path.relative(root,abs).split(path.sep).join('/');
 if(entry.isDirectory()){if(!ignored.has(entry.name))visit(abs);}
 else if(entry.isFile())discovered.push(rel);
}}
visit(root);
const known=new Set(discovered);
/** Resolve actual compiler edges, not just textual `from` expressions. */
function auditGraph(projectRoot, files, sourceOnly=false) {
 const absRoot=path.resolve(projectRoot), known=new Set(files), graph=new Map(),edges=[],violations=[],unresolvedExternal=[];
 const relative=p=>path.relative(absRoot,p).split(path.sep).join('/');
 const readConfig=file=>{
  const absolute=path.join(absRoot,file),raw=ts.readConfigFile(absolute,ts.sys.readFile);
  if(raw.error)throw new Error('Cannot read compiler configuration '+file);
  const parsed=ts.parseJsonConfigFileContent(raw.config,ts.sys,path.dirname(absolute),undefined,absolute);
  if(parsed.errors.some(x=>x.code!==18003))throw new Error('Invalid compiler configuration '+file);
  return parsed.options;
 };
 const base=readConfig('tsconfig.base.json'),desktop=readConfig('apps/desktop/tsconfig.json');
 const isBuiltin=s=>s.startsWith('node:')||builtinModules.includes(s)||builtinModules.includes(s.split('/')[0]);
 const layer=f=>f.startsWith('packages/domain/')?'domain':f.startsWith('packages/contracts/')?'contracts':f.startsWith('packages/application/')?'application':f.includes('/src/renderer/')?'renderer':f.includes('/src/preload/')?'preload':null;
 const allowed=(owner,spec,target,typeOnly)=>{
  const dst=target&&layer(target);
  if(!owner)return true;
  if(owner==='domain')return dst==='domain'||(dst==='contracts'&&typeOnly);
  if(owner==='contracts')return dst==='contracts';
  if(owner==='application')return ['application','domain','contracts'].includes(dst);
  if(owner==='renderer')return ['renderer','contracts'].includes(dst)||(!target&&/^(react|react-dom)(\/|$)/.test(spec));
  if(owner==='preload')return ['preload','contracts'].includes(dst)||(!target&&spec==='electron');
  return false;
 };
 for(const file of files.filter(p=>/\.(tsx?|mjs)$/.test(p))){
  const absolute=path.join(absRoot,file),owner=layer(file),opts=file.startsWith('apps/desktop/')?desktop:base;
  const sf=ts.createSourceFile(file,fs.readFileSync(absolute,'utf8'),ts.ScriptTarget.Latest,true);
  const links=[];
  const edge=(arg,typeOnly=false)=>{
   if(!arg||!ts.isStringLiteralLike(arg)){
    if(owner)violations.push(`${file}: nonliteral module reference in ${owner}`);
    return;
   }
   const spec=arg.text;let target=null;
   const builtin=isBuiltin(spec);
   if(!builtin){
    const resolved=ts.resolveModuleName(spec,absolute,opts,ts.sys).resolvedModule;
    if(resolved){const rel=relative(resolved.resolvedFileName);if(known.has(rel))target=rel;}
    // Vite's CSS side-effect imports are assets, not TypeScript modules.
    if(!target&&spec.startsWith('.')){const rel=relative(path.resolve(path.dirname(absolute),spec));if(known.has(rel)&&/\.css$/.test(rel))target=rel;}
    if(!target&&!resolved){
     const local=spec.startsWith('.')||path.isAbsolute(spec)||Object.keys(opts.paths??{}).some(k=>k.includes('*')?spec.startsWith(k.split('*')[0]):spec===k);
     if(local||!sourceOnly)violations.push(`${file}: unresolved module ${spec}`);
     else unresolvedExternal.push({file,spec});
    }
   }
   if(!allowed(owner,spec,target,typeOnly)||((owner==='renderer'||owner==='preload'||owner==='domain'||owner==='application'||owner==='contracts')&&builtin))violations.push(`${file}: forbidden ${owner} import ${spec}${target?' -> '+target:''}`);
   edges.push({from:file,specifier:spec,to:target,typeOnly,builtin});
   if(target&&!typeOnly)links.push(target);
  };
  function scan(n){
   if(ts.isImportDeclaration(n)){
    const c=n.importClause;
    const only=!!(c&&(c.isTypeOnly||(!c.name&&c.namedBindings&&ts.isNamedImports(c.namedBindings)&&c.namedBindings.elements.length&&c.namedBindings.elements.every(x=>x.isTypeOnly))));
    edge(n.moduleSpecifier,only);
   }else if(ts.isExportDeclaration(n)&&n.moduleSpecifier){
    const only=n.isTypeOnly||!!(n.exportClause&&ts.isNamedExports(n.exportClause)&&n.exportClause.elements.length&&n.exportClause.elements.every(x=>x.isTypeOnly));edge(n.moduleSpecifier,only);
   }else if(ts.isImportEqualsDeclaration(n)&&ts.isExternalModuleReference(n.moduleReference))edge(n.moduleReference.expression,n.isTypeOnly);
   else if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument))edge(n.argument.literal,true);
   else if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(n.expression)&&n.expression.text==='require')))edge(n.arguments[0]);
   ts.forEachChild(n,scan);
  }
  scan(sf);graph.set(file,[...new Set(links)]);
 }
 const visiting=new Set(),visited=new Set();
 function walk(n,stack=[]){if(visiting.has(n)){violations.push('Dependency cycle: '+[...stack,n].join(' -> '));return;}
  if(visited.has(n))return;visiting.add(n);for(const dep of graph.get(n)||[])if(graph.has(dep))walk(dep,[...stack,n]);visiting.delete(n);visited.add(n);
 }
 for(const n of graph.keys())walk(n);
 return {graph,edges,violations:[...new Set(violations)],unresolvedExternal};
}
function selfTest(){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-graph-'));
 try{
  const input={
   'tsconfig.base.json':JSON.stringify({compilerOptions:{moduleResolution:'bundler',module:'esnext',baseUrl:'.',paths:{'@db/*':['packages/persistence-sqlite/src/*']}}}),
   'apps/desktop/tsconfig.json':JSON.stringify({extends:'../../tsconfig.base.json'}),
   'apps/desktop/src/renderer/main.tsx':"import 'node:fs'; export {value} from '@db/private'; import('./missing'); import(moduleName); import type {T} from '../../../../packages/contracts/src/types';",
   'packages/contracts/src/types.ts':'export type T=string;',
   'packages/persistence-sqlite/src/private.ts':'export const value=1;',
   'packages/domain/src/a.ts':"export {b} from './b'; export const a=1;",
   'packages/domain/src/b.ts':"export {a} from './a'; export const b=2;"
  };
  for(const [name,data] of Object.entries(input)){const dest=path.join(folder,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);}
  const result=auditGraph(folder,Object.keys(input),true),v=result.violations.join('\n');
  for(const expected of ['forbidden renderer import node:fs','forbidden renderer import @db/private','unresolved module ./missing','nonliteral module reference','Dependency cycle:'])if(!v.includes(expected))throw new Error('Graph negative fixture missed '+expected);
  if(v.includes('forbidden renderer import ../../../../packages/contracts'))throw new Error('Valid contract type import rejected');
  console.log('PASS: compiler-resolved graph negative fixtures and valid contract type edge');
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
}
if(process.argv.includes('--self-test'))selfTest();
const {graph,edges,violations,unresolvedExternal}=auditGraph(root,discovered,process.argv.includes('--local-source-only'));
const newPaths=discovered.filter(p=>!canonical.has(p));
const unexplainedPaths=newPaths.filter(p=>!supplemental.has(p));
for(const p of unexplainedPaths)violations.push('Untracked architecture/support path: '+p);
for(const file of discovered.filter(p=>/^\.github\/workflows\/.+\.ya?ml$/.test(p))){
 const yaml=fs.readFileSync(path.join(root,file),'utf8');
 for(const match of yaml.matchAll(/^\s*(?:-\s*)?uses:\s*([^#\s]+)\s*(?:#.*)?$/gm)){
  if(!match[1].startsWith('./')&&!/@[0-9a-f]{40}$/i.test(match[1]))violations.push('Unpinned workflow action: '+file+' '+match[1]);
 }
}
const out={approvedCatalogPaths:canonical.size,createdFiles:discovered.length,
  approvedPathsPresent:discovered.filter(p=>canonical.has(p)).length,
  futureApprovedPathsNotYetCreated:[...canonical].filter(p=>!known.has(p)).length,
  supplementalPaths:newPaths.filter(p=>supplemental.has(p)),
  unexplainedPaths,
  knownException:'apps/desktop/index.html: proven Vite entry, owner-approved ADR-P2-001',
  moduleGraphNodes:graph.size,edges,unresolvedExternal,violations,status:violations.length?'FAIL':unresolvedExternal.length?'BOUNDED_SOURCE_ONLY':'PASS',
  note:'Missing planned paths are not empty placeholders. This does not prove native platform compatibility.'};
console.log(JSON.stringify(out,null,2));if(violations.length||canonical.size!==239)process.exitCode=1;
