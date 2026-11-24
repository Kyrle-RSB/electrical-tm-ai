import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './theme/tokens.css';
const node=document.getElementById('root');if(!node)throw new Error('Missing root');
createRoot(node).render(<React.StrictMode><App/></React.StrictMode>);
