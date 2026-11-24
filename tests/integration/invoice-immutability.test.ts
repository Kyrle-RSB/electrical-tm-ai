import {test} from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {LocalStore} from '../../packages/persistence-sqlite/src/connection';
test('drafts are editable while issued invoices and payment receipts reject updates/deletes',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tm-invoice-immut-'));
 try{const s=new LocalStore(path.join(tmp,'db.sqlite'));s.initializeFictionalCompany();
  const p=s.createProject({code:'SYN-IMM',customer:'Fictional',siteAddress:'100 Example St'});
  s.db.prepare('INSERT INTO invoice_drafts (id,project_id,body_json,updated_utc) VALUES (?,?,?,?)').run('draft',p,'{}','2026-11-23');
  s.db.prepare('UPDATE invoice_drafts SET body_json=? WHERE id=?').run('{"foo":2}','draft');
  s.db.prepare(`INSERT INTO issued_invoices VALUES (?,?,?,?,?,?,?,?)`).run('invoice',p,'INV-001','{}','2026-11-23',10000,'fake-sha','artifact/path.pdf');
  assert.throws(()=>s.db.prepare('UPDATE issued_invoices SET amount_cents=1 WHERE id=?').run('invoice'),/immutable/);
  assert.throws(()=>s.db.prepare('DELETE FROM issued_invoices WHERE id=?').run('invoice'),/immutable/);
  s.db.prepare('INSERT INTO payment_events VALUES (?,?,?,?,?,?,?)').run('pay','invoice',5000,'2026-11-23','cash','synthetic','2026-11-23');
  s.db.prepare('INSERT INTO payment_receipts VALUES (?,?,?,?,?,?)').run('rcpt','pay','{}',null,null,'2026-11-23');
  assert.throws(()=>s.db.prepare('UPDATE payment_receipts SET immutable_body_json=? WHERE id=?').run('{}','rcpt'),/immutable/);
  s.close();
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
