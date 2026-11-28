import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {applyAppearance,getSystemAppearance,readAppearancePreference,resolveAppearance,subscribeToSystemAppearance,writeAppearancePreference,type Appearance,type AppearancePreference} from './system-theme';

type AppearanceState={preference:AppearancePreference;appearance:Appearance;system:Appearance;setPreference:(next:AppearancePreference)=>void};
const AppearanceContext=createContext<AppearanceState|null>(null);

export function AppearanceProvider({children}:{children:ReactNode}){
 const [preference,setPreferenceState]=useState<AppearancePreference>(()=>readAppearancePreference());
 const [system,setSystem]=useState<Appearance>(getSystemAppearance);
 useEffect(()=>subscribeToSystemAppearance(setSystem),[]);
 const appearance=resolveAppearance(preference,system);
 useEffect(()=>{applyAppearance(appearance);},[appearance]);
 const setPreference=useCallback((next:AppearancePreference)=>{writeAppearancePreference(next);setPreferenceState(next);},[]);
 const value=useMemo(()=>({preference,appearance,system,setPreference}),[preference,appearance,system,setPreference]);
 return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
export function useAppearance():AppearanceState{
 const value=useContext(AppearanceContext);
 if(!value)throw new Error('useAppearance needs AppearanceProvider');
 return value;
}
