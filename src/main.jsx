import ReactDOM from 'react-dom/client'
import Hub from './Hub.jsx'
import './index.css'

// No StrictMode — the games rely on single-run mount effects for timers.
ReactDOM.createRoot(document.getElementById('root')).render(
  <Hub />
)
