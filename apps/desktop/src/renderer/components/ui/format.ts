/** Display text only. No arithmetic on money happens here: amounts arrive as the
 * domain's exact decimal text (formatMoney in packages/domain) and leave as text. */

const DOMAIN_MONEY=/^(-?)(0|[1-9][0-9]*)\.([0-9]{2})$/;
/** "-1234.50" (domain text) to "-$1,234.50" for display. */
export function displayMoney(decimal:string,currency='$'):string{
 const m=DOMAIN_MONEY.exec(decimal);
 if(!m)throw new Error('Expected domain money text such as 1234.50');
 return `${m[1]}${currency}${groupDigits(m[2])}.${m[3]}`;
}
export function groupDigits(digits:string):string{
 if(!/^[0-9]+$/.test(digits))throw new Error('Expected digits');
 return digits.replace(/\B(?=([0-9]{3})+(?![0-9]))/g,',');
}

/** Tidies typed money text ("$1,234.5", " 12 ") into the domain's input form
 * ("1234.5", "12"), or null when it cannot be money. The domain parser still
 * decides; this only lets a field show a clear message before saving. */
export function normalizeMoneyInput(text:string):string|null{
 const compact=text.trim().replace(/^(-?)\s*\$/,'$1').replace(/[\s,]/g,'');
 return /^-?(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(compact)?compact:null;
}

export type Platform='mac'|'other';
export function currentPlatform():Platform{
 return typeof navigator!=='undefined'&&/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent)?'mac':'other';
}
const keyNames:Record<string,{mac:string;other:string;spoken:{mac:string;other:string}}>={
 Mod:{mac:'⌘',other:'Ctrl',spoken:{mac:'Command',other:'Control'}},
 Shift:{mac:'⇧',other:'Shift',spoken:{mac:'Shift',other:'Shift'}},
 Alt:{mac:'⌥',other:'Alt',spoken:{mac:'Option',other:'Alt'}},
 Enter:{mac:'↵',other:'Enter',spoken:{mac:'Return',other:'Enter'}},
 Escape:{mac:'Esc',other:'Esc',spoken:{mac:'Escape',other:'Escape'}}
};
/** ['Mod','K'] to the keys to draw and the words a screen reader says. */
export function formatShortcut(keys:readonly string[],platform:Platform):{keys:string[];spoken:string}{
 return {
  keys:keys.map(k=>keyNames[k]?.[platform]??k.toUpperCase()),
  spoken:keys.map(k=>keyNames[k]?.spoken[platform]??k.toUpperCase()).join(' ')
 };
}
