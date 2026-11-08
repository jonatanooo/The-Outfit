import "./globals.css";
import { AuthProvider } from '@/lib/AuthContext';
import { CarritoProvider } from '@/lib/CarritoContext';


export const metadata = {
  title: 'The Outfit',
  description: 'Tienda de Ropa',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <CarritoProvider>
            {children}
          </CarritoProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
