/** Deterministic synthetic records, not real customers or invoices. Does not modify source fixtures. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const out=path.resolve(process.argv[2]||path.join(root,'dist-probe','synthetic-fixtures'));
fs.mkdirSync(out,{recursive:true,mode:0o700});
const data={schema:'forkb-synthetic-v1',company:'DEMO Electric (fictional)',date:'2026-11-23',
 projects:[{code:'SYN-001',customer:'Fictional Contractor',site:'101 Sample Road'},
  {code:'SYN-002',customer:'Illustration Ltd.',site:'20 Test Avenue'}],
 overhead:{date:'2026-11-23',dailyCents:30000,projectHalfDays:1,allocatedCents:15000,unallocatedCents:15000},
 labor:{employee:'Sample Apprentice',billHourCents:12000,fullyBurdenedCostHourCents:5500,hours:'2.000'}};
const file=path.join(out,'records.json');fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{mode:0o600});
const sha=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
console.log(JSON.stringify({synthetic:true,fixture:file,sha256:sha},null,2));
