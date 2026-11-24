/** Error taxonomy shared by main and renderer; never include arbitrary system paths in IPC errors. */
export type SafeIpcErrorCode='VALIDATION'|'CONFLICT'|'SECURITY'|'UNAVAILABLE'|'INTERNAL';
export type SafeIpcError={code:SafeIpcErrorCode;message:string};
export function classifyIpcError(error:unknown):SafeIpcError{
 const raw=error instanceof Error?error.message:'';
 if(/SECURITY|untrusted sender|Invalid request ID/i.test(raw))return{code:'SECURITY',message:'Operation was rejected by application security controls.'};
 if(/already exists|EEXIST|UNIQUE constraint|SQLITE_CONSTRAINT/i.test(raw))return{code:'CONFLICT',message:'That record or filename already exists. Choose a different value or review the existing record.'};
 if(/malformed|Invalid |must be|Unsupported|Expected |not permitted|Unknown disposition|exceeds/i.test(raw))
   return{code:'VALIDATION',message:'The supplied information is not valid for this operation.'};
 if(/not found|unavailable|ENOENT|cannot be opened|permission denied/i.test(raw))
   return{code:'UNAVAILABLE',message:'The requested local resource is unavailable. Check the selected location or permissions.'};
 return{code:'INTERNAL',message:'The operation could not be completed. Check the local diagnostic log.'};
}
