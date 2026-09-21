import CartDrawer from '@/components/CartDrawer'; 
import FavoritesDrawer from '@/components/FavoritesDrawer'; 
import ReduxProvider from '@/components/ReduxProvider'; 
import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <ReduxProvider>
          
          {/* Solo dejamos los cajones ocultos que necesitan estar en toda la app */}
          <CartDrawer /> 
          <FavoritesDrawer /> 
          
          <main>
            {children}
          </main>
          
        </ReduxProvider>
      </body>
    </html>
  );
}