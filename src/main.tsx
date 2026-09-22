import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';

// не работает защита от источников урона, я поставил 100% но урон все равно наносится

createRoot(document.getElementById('root')!).render(<App/>);
