import "./globals.css";
import Header from '@/components/Header'
import Footer from '@/components/Footer'


export const metadata = {
  title: 'The Outfit',
  description: 'Tienda de Ropa',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
