import {useEffect,useState} from 'react';
import {Badge,Button,Card,TextField} from '../../components/ui';
type Business = Awaited<ReturnType<Window['tmBridge']['getBusinessProfile']>>;
export function BusinessBranding({track}:{track:<T>(action:()=>Promise<T>)=>Promise<T>}){
 const [profile,setProfile]=useState<Business|null>(null);
 const [logo,setLogo]=useState<Awaited<ReturnType<Window['tmBridge']['getBusinessLogo']>>>(null);
 const [logoStatus,setLogoStatus]=useState('Loading logo status...');
 const [logoBusy,setLogoBusy]=useState(false);
 const [status,setStatus]=useState('Loading local business information...');
 useEffect(()=>{let mounted=true;window.tmBridge.getBusinessProfile()
  .then(v=>{if(mounted){setProfile(v);setStatus('Saved locally. No cloud account required.');}})
  .catch(e=>{if(mounted)setStatus('Unable to load business profile: '+String(e));});
  window.tmBridge.getBusinessLogo().then(v=>{if(mounted){setLogo(v);setLogoStatus(v?'Synthetic logo stored locally.':'No logo selected.');}}).catch(e=>{if(mounted)setLogoStatus('Unable to read logo: '+String(e));});
  return ()=>{mounted=false;};},[]);
 if(!profile)return <Card title="Business profile" label="Business profile"><p role="status" className="project-status">{status}</p></Card>;
 const field=(key:keyof Business,label:string,max:number,type:'text'|'email'|'tel'='text')=>
  <TextField key={key} label={label} type={type} maxLength={max} value={profile[key]}
   onChange={e=>setProfile({...profile,[key]:e.target.value})}/>;
 return <Card title="Business profile" label="Business profile" description="Your company's legal identity and invoice footer fields. Fictional data only in this foundation build.">
  <form className="form-grid form-grid--two" onSubmit={async e=>{e.preventDefault();setStatus('Saving...');try{
   const {currency:_currency,...input}=profile;
   await track(()=>window.tmBridge.updateBusinessProfile(input));
   setStatus('Saved to local SQLite.');
  }catch(error){setStatus('Could not save: '+String(error));}}}>
   {field('legalName','Legal business name',200)}
   {field('tradeName','Trade name',200)}
   <div className="form-grid__full">{field('mailingAddress','Business mailing address',600)}</div>
   {field('phone','Telephone',80,'tel')}
   {field('email','Email',254,'email')}
   {field('taxId','Tax registration ID',100)}
   {field('contractorLicense','Electrical contractor license ID',100)}
   <div className="actions form-grid__full"><Button type="submit" variant="primary">Save local business profile</Button></div>
  </form><p role="status" className="project-status">{status}</p>
  <div className="subsection"><div className="subsection__head"><h3>Optional local logo</h3>{logo&&<Badge tone="success" dot>Stored</Badge>}</div><p role="status" className="muted">{logoStatus}</p>
  <div className="actions"><Button size="sm" disabled={logoBusy} loading={logoBusy} onClick={async()=>{setLogoBusy(true);try{const picked=await track(()=>window.tmBridge.chooseBusinessLogo());if(picked){setLogo(picked);setLogoStatus('Synthetic logo stored locally.');}else setLogoStatus('Selection canceled. Existing logo unchanged.');}catch(error){setLogoStatus('Logo not saved: '+String(error));}finally{setLogoBusy(false);}}}>Choose synthetic logo</Button>
  {logo&&<Button size="sm" variant="ghost" disabled={logoBusy} onClick={async()=>{setLogoBusy(true);try{await track(()=>window.tmBridge.removeBusinessLogo());setLogo(null);setLogoStatus('Logo reference removed. Historical assets retained.');}catch(error){setLogoStatus('Logo not removed: '+String(error));}finally{setLogoBusy(false);}}}>Remove logo reference</Button>}</div></div>
 </Card>;
}
