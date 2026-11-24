import path from 'node:path';
/** Resolve only internally generated photo locators, never user-supplied arbitrary paths. */
const IMAGE=/^images\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg)$/i;
export function resolveManagedImage(vaultRoot:string,locator:string):string{
 if(!IMAGE.test(locator))throw new Error('Invalid managed image locator');
 const root=path.resolve(vaultRoot),target=path.resolve(root,locator);
 if(!target.startsWith(root+path.sep))throw new Error('Managed image path escapes vault');
 return target;
}
