import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import PresentationView from './components/PresentationView'
import './index.css'

const getIsPresentation = () => {
    try {
        const url = new URL(window.location.href);
        const hasParam = url.searchParams.get('view') === 'presentation' ||
            url.searchParams.get('view') === 'Presentation';
        const hasHash = window.location.hash.toLowerCase().includes('view=presentation');
        const hasHref = window.location.href.toLowerCase().includes('view=presentation');
        return hasParam || hasHash || hasHref;
    } catch (e) {
        return window.location.href.toLowerCase().includes('view=presentation');
    }
};

const isPresentationView = getIsPresentation();
window.__KRAOQ_PRESENTATION__ = isPresentationView; // For browser console debugging

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {isPresentationView ? <PresentationView /> : <App />}
    </React.StrictMode>,
)
