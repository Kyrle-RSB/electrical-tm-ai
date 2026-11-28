import {Card,SegmentedControl,type SegmentOption} from '../../components/ui';
import {useAppearance} from '../../theme/AppearanceProvider';
import type {AppearancePreference} from '../../theme/system-theme';
const options:readonly SegmentOption<AppearancePreference>[]=[
 {value:'system',label:'System',icon:'monitor'},{value:'light',label:'Light',icon:'sun'},{value:'dark',label:'Dark',icon:'moon'}
];
/** Settings: follow the computer's theme, or pick one. Kept on this computer only. */
export function AppearanceSetting(){
 const {preference,appearance,system,setPreference}=useAppearance();
 return <Card title="Appearance" titleId="appearance-title" description="Follow your computer's light or dark setting, or choose one. Saved on this computer only.">
  <div className="appearance-row">
   <SegmentedControl legend="Theme" name="appearance" options={options} value={preference} onChange={setPreference}/>
   <p className="muted">{preference==='system'?`Following your computer: ${system}.`:`Showing ${appearance} whatever your computer uses.`}</p>
  </div>
 </Card>;
}
