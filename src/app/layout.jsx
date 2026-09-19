import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer'; 
import FavoritesDrawer from '@/components/FavoritesDrawer'; // <-- NUEVA IMPORTACIÓN
import ReduxProvider from '@/components/ReduxProvider'; 
import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <ReduxProvider>
          <Header />
          <CartDrawer /> 
          <FavoritesDrawer /> {/* <-- INYÉCTALO AQUÍ */}
          <main className="min-h-screen">
            {children}
          </main>
          <Footer />
        </ReduxProvider>
      </body>
    </html>
  );
}