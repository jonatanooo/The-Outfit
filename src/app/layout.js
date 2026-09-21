import "./globals.css";
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { CarritoProvider } from '@/lib/CarritoContext'


export const metadata = {
  title: 'The Outfit',
  description: 'Tienda de Ropa',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <CarritoProvider>
          {children}
        </CarritoProvider>
      </body>
    </html>
  );
}
