import "./globals.css";
import { AuthProvider } from '@/lib/AuthContext';
import { CarritoProvider } from '@/lib/CarritoContext';
import { AlertaProvider } from '@/lib/AlertaContext';


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
            <AlertaProvider>
              {children}
            </AlertaProvider>
          </CarritoProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
