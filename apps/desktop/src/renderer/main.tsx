import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {AppearanceProvider} from './theme/AppearanceProvider';
import {ToastProvider} from './components/ui/Toast';
import {applyAppearance,getSystemAppearance,readAppearancePreference,resolveAppearance} from './theme/system-theme';
import './theme/tokens.css';
import './theme/base.css';
import './components/ui/components.css';
import './theme/screens.css';
// Resolve the theme before the first paint so the window never flashes the wrong one.
applyAppearance(resolveAppearance(readAppearancePreference(),getSystemAppearance()));
const node=document.getElementById('root');if(!node)throw new Error('Missing root');
createRoot(node).render(<React.StrictMode><AppearanceProvider><ToastProvider><App/></ToastProvider></AppearanceProvider></React.StrictMode>);
