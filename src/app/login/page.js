'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, aplicarMantenerSesion } from '@/lib/supabaseClient';
import Footer from '@/components/Footer';

/* ---------- Iconos SVG (redes + ojo + Google) ---------- */
const IconInstagram = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const IconTiktok = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M14.5 3h2.4c.2 1.5 1.2 2.9 2.9 3.4v2.4c-1.1 0-2.1-.3-2.9-.9v6.6c0 3-2.4 5.5-5.5 5.5S6 17.5 6 14.5c0-2.9 2.2-5.2 5-5.5v2.5a3 3 0 1 0 3 3V3z" />
  </svg>
);

const IconYoutube = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
    <rect x="2.5" y="6" width="19" height="12" rx="3.5" />
    <path d="M10.5 9.5l5 2.5-5 2.5v-5z" fill="currentColor" stroke="none" />
  </svg>
);

const IconFacebook = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
    <path d="M15 4h-2a4 4 0 0 0-4 4v2H7v3h2v7h3v-7h2.5l.5-3H12V8a1 1 0 0 1 1-1h2V4z" />
  </svg>
);

const IconEyeOpen = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeClosed = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c7 0 10.5 7 10.5 7a13.5 13.5 0 0 1-3.1 4.1M6.6 6.6C3.4 8.6 1.5 12 1.5 12s3.5 7 10.5 7c1.4 0 2.7-.28 3.9-.75" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

const IconGoogle = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mantenerSesion, setMantenerSesion] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [resetInfo, setResetInfo] = useState('');

  const handleOlvideContrasena = async () => {
    setError('');
    if (!correo.trim()) {
      setError('Escribí tu correo arriba y volvé a hacer clic en "¿Has olvidado la contraseña?"');
      return;
    }

    setEnviandoReset(true);
    setResetInfo('');
    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/restablecer-password`,
    });
    setEnviandoReset(false);

    if (error) {
      setError(error.message);
    } else {
      setResetInfo('Si ese correo tiene una cuenta, te enviamos un enlace para restablecer la contraseña.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!correo.trim() || !password.trim()) {
      setError('Todos los campos son obligatorios');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: correo,
        password: password,
      });

      if (error) throw error;

      aplicarMantenerSesion(mantenerSesion);

      const rol = data.user?.app_metadata?.rol || 'usuario';
      if (rol === 'admin') {
        router.push('/admin');
      } else if (rol === 'empleado') {
        router.push('/empleado');
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error(error);
      setError(error.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  } catch (error) {
    console.error('Error al iniciar con Google:', error.message);
    alert('Error al iniciar sesión con Google. Intenta de nuevo.');
  }
};

  return (
    <div className="w-full flex flex-col bg-white">
      <div className="flex flex-col md:flex-row">

        {/* Imagen */}
        <div className="hidden md:block md:w-1/2 md:min-h-[660px] relative overflow-hidden">
          <img
            src="/Fotos/imagen2.webp"
            alt="Modelo"
            className="absolute inset-0 h-full w-full object-contain object-top"
          />
        </div>

        {/* Columna derecha */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center px-6 sm:px-10 md:px-16 py-16">
          <div className="w-full max-w-sm flex flex-col">

            {/* 🔓 THE OUTFIT */}
            <h1
              className="text-3xl md:text-5xl font-serif tracking-[0.15em] text-black text-center"
              style={{ marginBottom: '20px' }}
            >
              THE OUTFIT
            </h1>

            {/* 🔓 INICIAR SESIÓN  */}
            <h2
              className="text-xl md:text-2xl font-light tracking-[0.1em] text-black text-center"
              style={{ marginBottom: '30px' }}
            >
              INICIAR SESIÓN
            </h2>

            
            <form onSubmit={handleSubmit} className="flex flex-col">

              {/* 🔓 CORREO  */}
              <div style={{ marginBottom: '28px' }}>
                <input
                  type="email"
                  name="correo"
                  placeholder="Usuario / Correo"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="w-full h-11 border border-gray-300 rounded-sm px-4 text-base focus:outline-none focus:border-black"
                />
              </div>

              {/* 🔓 CONTRASEÑA */}
              <div className="relative" style={{ marginBottom: '28px' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 border border-gray-300 rounded-sm px-4 text-base tracking-wide focus:outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition"
                >
                  {showPassword ? <IconEyeClosed className="w-5 h-5" /> : <IconEyeOpen className="w-5 h-5" />}
                </button>
              </div>

              {error && <p className="text-red-500 text-xs" style={{ marginBottom: '16px' }}>{error}</p>}
              {resetInfo && <p className="text-green-600 text-xs" style={{ marginBottom: '16px' }}>{resetInfo}</p>}

              {/* 🔓 CHECKBOX  */}
              <div
                className="flex items-center justify-between text-xs text-gray-700"
                style={{ marginBottom: '28px' }}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mantenerSesion}
                    onChange={(e) => setMantenerSesion(e.target.checked)}
                    className="w-4 h-4 accent-black"
                  />
                  <span>Mantener Sesión</span>
                </label>
                <button
                  type="button"
                  onClick={handleOlvideContrasena}
                  disabled={enviandoReset}
                  className="hover:underline disabled:opacity-50"
                >
                  {enviandoReset ? 'ENVIANDO...' : '¿HAS OLVIDADO LA CONTRASEÑA?'}
                </button>
              </div>

              {/* 🔓 BOTÓN CONTINUAR  */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-black text-white text-base tracking-[0.3em] font-medium hover:bg-gray-800 transition disabled:opacity-50"
                style={{ marginBottom: '0px' }}
              >
                {loading ? 'CARGANDO...' : 'CONTINUAR'}
              </button>
            </form>

            {/* 🔓 "¿NO TIENES CUENTA AÚN?"  */}
            <div style={{ marginTop: '30px' }}>
              <p className="text-xs tracking-wider text-gray-700 text-center">
                ¿NO TIENES CUENTA AÚN?{' '}
                <Link href="/register" className="font-bold underline">
                  REGÍSTRATE AHORA
                </Link>
              </p>
            </div>

            {/* 🔓 "ACCEDER CON"  */}
            <div style={{ marginTop: '50px' }}>
              <p
                className="text-center text-sm tracking-[0.1em] text-gray-700"
                style={{ marginBottom: '10px' }}
              >
                ACCEDER CON
              </p>

              {/* Botón Google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full h-12 flex items-center justify-center gap-3 border border-gray-300 rounded-sm hover:bg-gray-50 transition"
              >
                <IconGoogle className="w-5 h-5" />
                <span className="text-sm tracking-wider text-gray-800">
                  CONTINUAR CON GOOGLE
                </span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}