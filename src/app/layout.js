import "./globals.css";


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
