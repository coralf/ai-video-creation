import './App.css';
import React from 'react';
import { WorkspacePage } from '../modules/workspace/workspace-page';


export default function App() {
    return (
        <div className='app-shell'>
            <WorkspacePage />
        </div>
    );
}
