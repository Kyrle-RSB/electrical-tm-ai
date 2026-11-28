import {currentPlatform,formatShortcut,type Platform} from './format';
/** A keyboard hint such as Cmd K on a Mac and Ctrl K elsewhere. Use 'Mod' for the main modifier.
 * Screen readers hear the words ("Command K"), not the symbols. */
export function Kbd({keys,platform=currentPlatform()}:{keys:readonly string[];platform?:Platform}){
 const shortcut=formatShortcut(keys,platform);
 return <span className="tm-kbd">
  <span aria-hidden="true" className="tm-kbd__keys">{shortcut.keys.map((k,i)=><kbd key={i} className="tm-kbd__key">{k}</kbd>)}</span>
  <span className="tm-visually-hidden">{shortcut.spoken}</span>
 </span>;
}
