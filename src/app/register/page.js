'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

/* ---------- Iconos de redes sociales  */
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
);

const IconEyeClosed = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c7 0 10.5 7 10.5 7a13.5 13.5 0 0 1-3.1 4.1M6.6 6.6C3.4 8.6 1.5 12 1.5 12s3.5 7 10.5 7c1.4 0 2.7-.28 3.9-.75" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    telefono: '',
    password: '',
    aceptaPromos: false,
    aceptaTerminos: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errores, setErrores] = useState({});
  const [loading, setLoading] = useState(false);

  const validarPassword = (pwd) => {
    const erroresPwd = [];
    if (pwd.length < 8) erroresPwd.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(pwd)) erroresPwd.push('Al menos una mayúscula');
    if (!/[a-z]/.test(pwd)) erroresPwd.push('Al menos una minúscula');
    if (!/[0-9]/.test(pwd)) erroresPwd.push('Al menos un número');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) erroresPwd.push('Al menos un símbolo');
    return erroresPwd;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nuevosErrores = {};

    if (!form.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio';
    if (!form.correo.trim()) nuevosErrores.correo = 'El correo es obligatorio';
    else if (!/\S+@\S+\.\S+/.test(form.correo)) nuevosErrores.correo = 'Correo inválido';
    if (!form.telefono.trim()) nuevosErrores.telefono = 'El teléfono es obligatorio';
    else if (!/^\d{8}$/.test(form.telefono)) nuevosErrores.telefono = 'Debe tener 8 dígitos';

    const erroresPwd = validarPassword(form.password);
    if (erroresPwd.length > 0) nuevosErrores.password = erroresPwd.join(', ');

    if (!form.aceptaTerminos) nuevosErrores.aceptaTerminos = 'Debes aceptar los términos y condiciones';

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    setErrores({});
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.correo,
        password: form.password,
        options: {
          data: {
            nombre: form.nombre,
            telefono: form.telefono,
            rol: 'usuario',
          },
        },
      });

      if (error) throw error;

      alert('¡Cuenta creada! Revisa tu correo para confirmar.');
      router.push('/login');
    } catch (error) {
      console.error(error);
      setErrores({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col bg-white">
      <div className="flex flex-col md:flex-row">

        {/* Imagen */}
        <div className="hidden md:block md:w-1/2 md:min-h-[660px] relative overflow-hidden">
          <img
            src="/Fotos/imagen.jpg"
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

            {/* 🔓 CREAR CUENTA  */}
            <h2
              className="text-xl md:text-2xl font-light tracking-[0.1em] text-black text-center"
              style={{ marginBottom: '30px' }}
            >
              CREAR CUENTA
            </h2>

            
            <form onSubmit={handleSubmit} className="flex flex-col">

              {/* 🔓 NOMBRE  */}
              <div style={{ marginBottom: '28px' }}>
                <input
                  type="text"
                  name="nombre"
                  placeholder="Nombre completo"
                  value={form.nombre}
                  onChange={handleChange}
                  className="w-full h-11 border border-gray-300 rounded-sm px-4 text-base focus:outline-none focus:border-black"
                />
                {errores.nombre && <p className="text-red-500 text-xs" style={{ marginTop: '4px' }}>{errores.nombre}</p>}
              </div>

              {/* 🔓 CORREO  */}
              <div style={{ marginBottom: '28px' }}>
                <input
                  type="email"
                  name="correo"
                  placeholder="Correo electrónico"
                  value={form.correo}
                  onChange={handleChange}
                  className="w-full h-11 border border-gray-300 rounded-sm px-4 text-base tracking-wide focus:outline-none focus:border-black"
                />
                {errores.correo && <p className="text-red-500 text-xs" style={{ marginTop: '4px' }}>{errores.correo}</p>}
              </div>

              {/* 🔓 CONTRASEÑA  */}
              <div className="relative" style={{ marginBottom: '10px' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Contraseña"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full h-11 border border-gray-300 rounded-sm px-4 text-base tracking-wide focus:outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition"
                >
                  {showPassword ? <IconEyeClosed className="w-5 h-5" /> : <IconEyeOpen className="w-5 h-5" />}
                </button>
                {errores.password && <p className="text-red-500 text-xs" style={{ marginTop: '4px' }}>{errores.password}</p>}
              </div>

              {/* 🔓 TELÉFONO  */}
              <div style={{ marginBottom: '25px' }}>
                <label className="block text-xs uppercase tracking-wider text-gray-700" style={{ marginBottom: '6px' }}>
                  Teléfono
                </label>
                <div className="flex">
                  <span className="h-11 flex items-center border border-gray-300 rounded-l-sm px-4 text-base bg-gray-50 text-gray-600">
                    +503
                  </span>
                  <input
                    type="tel"
                    name="telefono"
                    placeholder="00000000"
                    value={form.telefono}
                    onChange={handleChange}
                    maxLength={8}
                    className="flex-1 h-11 border border-l-0 border-gray-300 rounded-r-sm px-4 text-base focus:outline-none focus:border-black"
                  />
                </div>
                {errores.telefono && <p className="text-red-500 text-xs" style={{ marginTop: '4px' }}>{errores.telefono}</p>}
              </div>

              {/* 🔓 CHECKBOXES  */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ marginBottom: '-1px' }}>
                  <label className="flex items-start gap-2 text-xs text-gray-700 leading-relaxed">
                    <input
                      type="checkbox"
                      name="aceptaPromos"
                      checked={form.aceptaPromos}
                      onChange={handleChange}
                      className="mt-0.5 w-4 h-4 accent-black"
                    />
                    <span>
                      Acepto recibir noticias, notificaciones y promociones de The Outfit.
                    </span>
                  </label>
                </div>

                <div>
                  <label className="flex items-start gap-2 text-xs text-gray-700 leading-relaxed">
                    <input
                      type="checkbox"
                      name="aceptaTerminos"
                      checked={form.aceptaTerminos}
                      onChange={handleChange}
                      className="mt-0.5 w-4 h-4 accent-black"
                    />
                    <span>
                      Al dar clic en crear cuenta, acepto los términos y condiciones de The Outfit.
                    </span>
                  </label>
                  {errores.aceptaTerminos && <p className="text-red-500 text-xs" style={{ marginTop: '4px' }}>{errores.aceptaTerminos}</p>}
                </div>
              </div>

              {errores.general && <p className="text-red-500 text-sm" style={{ marginBottom: '16px' }}>{errores.general}</p>}

              {/* 🔓 BOTÓN CREAR CUENTA  */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-black text-white text-base tracking-[0.3em] font-medium hover:bg-gray-800 transition disabled:opacity-50"
                style={{ marginTop: '-15px' }}
              >
                {loading ? 'CREANDO...' : 'CREAR CUENTA'}
              </button>
            </form>

            {/* 🔓 "¿YA TIENES CUENTA?"  */}
            <div style={{ marginTop: '10px' }}>
              <p className="text-xs tracking-wider text-gray-700 text-center">
                ¿YA TIENES CUENTA?{' '}
                <Link href="/login" className="font-bold underline">
                  INICIA SESIÓN
                </Link>
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 sm:px-10 md:px-20 py-8">
        <div className="flex flex-col md:flex-row justify-between gap-8 max-w-6xl mx-auto text-xs text-gray-700">
          <div className="md:w-1/4">
            <p className="font-serif text-lg mb-3 text-black">The Outfit</p>
            <div className="flex gap-4">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition">
                <IconInstagram className="w-5 h-5" />
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition">
                <IconTiktok className="w-5 h-5" />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition">
                <IconYoutube className="w-5 h-5" />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition">
                <IconFacebook className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div className="md:w-1/4">
            <p className="font-bold uppercase tracking-wider mb-2 text-black">Ayuda</p>
            <Link href="/pagos" className="block mb-1 hover:underline cursor-pointer">Pagos</Link>
            <Link href="/devoluciones" className="block mb-1 hover:underline cursor-pointer">Devoluciones</Link>
            <Link href="/envios" className="block hover:underline cursor-pointer">Envíos</Link>
          </div>

          <div className="md:w-1/4">
            <p className="font-bold uppercase tracking-wider mb-2 text-black">Sobre Nosotros</p>
            <Link href="/historia" className="block mb-1 hover:underline cursor-pointer">Historia</Link>
            <Link href="/ubicacion" className="block hover:underline cursor-pointer">Ubicación</Link>
          </div>

          <div className="md:w-1/4">
            <p className="font-bold uppercase tracking-wider mb-2 text-black">Recomendaciones</p>
            <Link href="/verano" className="block mb-1 hover:underline cursor-pointer">Temporada de Verano</Link>
            <Link href="/ofertas" className="block hover:underline cursor-pointer">Ofertas Agosto</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}