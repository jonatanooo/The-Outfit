"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { verificarAccesoServidor } from '@/lib/usuario';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    let activo = true;
    async function validarAccesoAdmin() {
      try {
        const acceso = await verificarAccesoServidor('admin');
        if (!activo) return;
        if (!acceso.autorizado) {
          router.replace(acceso.rol === 'anonimo' ? '/login' : '/');
          return;
        }
        setAutorizado(true);
      } catch {
        if (activo) router.replace('/');
      }
    }

    validarAccesoAdmin();
    return () => {
      activo = false;
    };
  }, [authUser, authLoading, router]);

  if (!autorizado) {
    return null;
  }

  return <>{children}</>;
}
