/** Synchronous single-writer transaction with proper rollback and no floating-point financial truth. */
export interface SqliteLike {exec(sql:string):void}
export function withImmediateTransaction<T>(db:SqliteLike,action:()=>T):T {
 db.exec('BEGIN IMMEDIATE');
 try {const result=action();db.exec('COMMIT');return result;}
 catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}
}
