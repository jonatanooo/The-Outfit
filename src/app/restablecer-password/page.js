'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebaseClient';
import { confirmPasswordReset, verifyPasswordResetCode, updatePassword } from 'firebase/auth';

/**
 * Misma política estricta de complejidad de contraseña exigida en el registro.
 */
const REQUISITOS_PASSWORD = [
  { id: 'len', label: 'Mínimo 8 caracteres', test: (pwd) => pwd.length >= 8 },
  { id: 'upper', label: 'Al menos una letra mayúscula (A-Z)', test: (pwd) => /[A-Z]/.test(pwd) },
  { id: 'lower', label: 'Al menos una letra minúscula (a-z)', test: (pwd) => /[a-z]/.test(pwd) },
  { id: 'num', label: 'Al menos un número (0-9)', test: (pwd) => /[0-9]/.test(pwd) },
  { id: 'sym', label: 'Al menos un símbolo (!@#$%^&*...)', test: (pwd) => /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]~`';]/.test(pwd) },
];

export default function RestablecerPasswordPage() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [oobCode, setOobCode] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('oobCode');
      if (code) {
        setOobCode(code);
        verifyPasswordResetCode(auth, code)
          .then(() => setListo(true))
          .catch((err) => {
            console.error('Código inválido:', err);
            setError('El enlace para restablecer la contraseña es inválido o ya expiró.');
          });
      } else if (auth.currentUser) {
        setListo(true);
      }
    }
  }, []);

  const estadoRequisitos = REQUISITOS_PASSWORD.map((req) => ({
    ...req,
    cumplido: req.test(password || ''),
  }));
  const todosRequisitosCumplidos = estadoRequisitos.every((r) => r.cumplido);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const faltantes = estadoRequisitos.filter((r) => !r.cumplido).map((r) => r.label);
    if (faltantes.length > 0) {
      setError(`La contraseña no cumple los requisitos: ${faltantes.join(', ')}.`);
      return;
    }

    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      if (oobCode) {
        await confirmPasswordReset(auth, oobCode, password);
      } else if (auth.currentUser) {
        await updatePassword(auth.currentUser, password);
      } else {
        throw new Error('No se encontró el código de verificación.');
      }
      setOk(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center px-6 py-24 bg-white min-h-[500px]">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-light tracking-[0.1em] text-black text-center" style={{ marginBottom: '30px' }}>
          RESTABLECER CONTRASEÑA
        </h1>

        {!listo && !error && (
          <p className="text-sm text-gray-600 text-center">
            Abrí esta página desde el enlace que te enviamos por correo.
          </p>
        )}

        {!listo && error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
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

            <input
              type="password"
              placeholder="Confirmar nueva contraseña"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              className="w-full h-11 border border-gray-300 rounded-sm px-4 text-base text-black focus:outline-none focus:border-black"
            />

            {/* Indicador visual en tiempo real de los requisitos de complejidad */}
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: '#fafafa',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
              }}
            >
              <p className="text-xs font-medium text-gray-700" style={{ marginBottom: '6px' }}>
                Requisitos de seguridad de la contraseña:
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {estadoRequisitos.map((req) => (
                  <li
                    key={req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.75rem',
                      color: req.cumplido ? '#15803d' : '#6b7280',
                      fontWeight: req.cumplido ? 600 : 400,
                      marginBottom: '2px',
                    }}
                  >
                    <span>{req.cumplido ? '✓' : '○'}</span>
                    <span>{req.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading || !todosRequisitosCumplidos}
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
