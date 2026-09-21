'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function RestablecerPasswordPage() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  // El enlace del correo crea una sesión de recuperación automáticamente al cargar la página
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setListo(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setListo(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setOk(true);
      setTimeout(() => router.push('/login'), 2000);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center px-6 py-24 bg-white min-h-[500px]">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-light tracking-[0.1em] text-black text-center" style={{ marginBottom: '30px' }}>
          RESTABLECER CONTRASEÑA
        </h1>

        {!listo && (
          <p className="text-sm text-gray-600 text-center">
            Abrí esta página desde el enlace que te enviamos por correo.
          </p>
        )}

        {listo && !ok && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 border border-gray-300 rounded-sm px-4 text-base text-black focus:outline-none focus:border-black"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-black text-white text-base tracking-[0.3em] font-medium hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? 'GUARDANDO...' : 'GUARDAR CONTRASEÑA'}
            </button>
          </form>
        )}

        {ok && (
          <p className="text-green-600 text-sm text-center">
            Contraseña actualizada. Redirigiendo al login...
          </p>
        )}
      </div>
    </div>
  );
}
