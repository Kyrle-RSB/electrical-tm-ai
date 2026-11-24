/** Synchronous transaction ownership; nested repository operations use savepoints. */
export interface SqliteLike {exec(sql:string):void}
const owned=new WeakSet<SqliteLike>();
let nextSavepoint=0;
export function withImmediateTransaction<T>(db:SqliteLike,action:()=>T):T {
 const nested=owned.has(db);
 const savepoint=`tm_uow_${++nextSavepoint}`;
 db.exec(nested?`SAVEPOINT ${savepoint}`:'BEGIN IMMEDIATE');
 if(!nested)owned.add(db);
 try{
  const result=action();
  if(result!==null&&typeof result==='object'&&'then' in result)throw new Error('Asynchronous work is not permitted inside the SQLite unit of work');
  db.exec(nested?`RELEASE SAVEPOINT ${savepoint}`:'COMMIT');return result;
 }catch(error){
  try{if(nested){db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);db.exec(`RELEASE SAVEPOINT ${savepoint}`);}else db.exec('ROLLBACK');}
  catch(rollbackError){throw new AggregateError([error,rollbackError],'SQLite transaction rollback failed; connection state requires recovery');}
  throw error;
 }finally{if(!nested)owned.delete(db);}
}
