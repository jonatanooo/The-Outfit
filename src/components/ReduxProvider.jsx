'use client'; // Esta directiva es obligatoria para usar Redux en el App Router

import { Provider } from 'react-redux';
import { store } from '../store/store'; // Ajusta la ruta dependiendo de dónde guardes la carpeta store

export default function ReduxProvider({ children }) {
  return <Provider store={store}>{children}</Provider>;
}