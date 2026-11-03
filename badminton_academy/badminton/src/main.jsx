/* main.jsx — entry point. Mounts <App/> inside a HashRouter (URLs look like /#/admin) and loads the global CSS. */
import React from 'react';import {createRoot} from 'react-dom/client';import {HashRouter} from 'react-router-dom';
import App from './App';import './index.css';
createRoot(document.getElementById('root')).render(<HashRouter><App/></HashRouter>);
