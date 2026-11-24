/**
 * Process-local serialization for all operations using the single SQLite connection,
 * the managed asset vault, and backup/restore. This keeps a snapshot from racing
 * image ingestion or a database mutation while the async backup runs.
 * This is not a cross-process lock. The app's single-instance invariant is required.
 */
export class LocalOperationQueue {
  private tail:Promise<void>=Promise.resolve();
  private closed=false;
  run<T>(operation:()=>Promise<T>|T):Promise<T>{
    if(this.closed)return Promise.reject(new Error('Application is shutting down'));
    const current=this.tail.then(operation);
    this.tail=current.then(()=>{},()=>{});
    return current;
  }
  async drain():Promise<void>{this.closed=true;await this.tail;}
}
