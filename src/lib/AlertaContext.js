"use client";

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import '@/components/MensajeEmergente.css';

const AlertaContext = createContext({
  mostrarAlerta: async () => true,
  mostrarConfirmacion: async () => false,
});

// Puente imperativo para poder lanzar mensajes desde cualquier hook o utilidad
let despachadorGlobal = null;
const colaPendiente = [];

/**
 * Normaliza y personaliza el título, tipo e ícono de cada mensaje emergente de la tienda.
 */
function personalizarMensajeEmergente(entrada, esConfirmacion = false) {
  const base =
    typeof entrada === 'string'
      ? { mensaje: entrada }
      : { ...(entrada || {}) };

  const textoOriginal = String(base.mensaje || '');
  const lower = textoOriginal.toLowerCase();

  if (!base.titulo) {
    if (esConfirmacion) {
      base.titulo = 'Confirmar acción';
    } else if (lower.includes('favorit') && lower.includes('sesión')) {
      base.titulo = 'Inicia sesión para tus favoritos';
      base.tipo = base.tipo || 'favoritos';
      base.mensaje =
        'Inicia sesión en tu cuenta de The Outfit para guardar tus prendas favoritas y encontrarlas cuando quieras.';
      base.textoConfirmar = base.textoConfirmar || 'Iniciar sesión';
      base.textoCancelar = base.textoCancelar || 'Cerrar';
      base.hrefConfirmar = base.hrefConfirmar || '/login';
    } else if (lower.includes('agreg') && lower.includes('cesta')) {
      base.titulo = '¡Agregado a tu cesta!';
      base.tipo = base.tipo || 'exito';
    } else if (lower.includes('stock') || lower.includes('unidades disponibles')) {
      base.titulo = 'Disponibilidad de stock';
      base.tipo = base.tipo || 'aviso';
    } else if (lower.includes('cuenta creada') || lower.includes('éxito') || lower.includes('correctamente') || lower.includes('exitosamente')) {
      base.titulo = '¡Operación exitosa!';
      base.tipo = base.tipo || 'exito';
    } else if (lower.includes('banead') || lower.includes('suspendid')) {
      base.titulo = 'Acceso restringido';
      base.tipo = base.tipo || 'error';
    } else if (lower.includes('error') || lower.includes('no se pudo') || lower.includes('obligatorio') || lower.includes('inválid')) {
      base.titulo = 'Atención';
      base.tipo = base.tipo || 'error';
    } else {
      base.titulo = 'Aviso de The Outfit';
    }
  }

  return {
    tipo: base.tipo || (esConfirmacion ? 'confirmar' : 'info'),
    titulo: base.titulo,
    mensaje: base.mensaje || '',
    textoConfirmar: base.textoConfirmar || (esConfirmacion ? 'Confirmar' : 'Aceptar'),
    textoCancelar: base.textoCancelar || (esConfirmacion ? 'Cancelar' : null),
    hrefConfirmar: base.hrefConfirmar || null,
    esConfirmacion: Boolean(esConfirmacion),
  };
}

function encolarDialogo(entrada, esConfirmacion) {
  const payload = personalizarMensajeEmergente(entrada, esConfirmacion);
  if (typeof window === 'undefined') {
    return Promise.resolve(!esConfirmacion);
  }

  return new Promise((resolve) => {
    const item = { ...payload, resolve };
    if (despachadorGlobal) {
      despachadorGlobal(item);
    } else {
      colaPendiente.push(item);
    }
  });
}

/**
 * Muestra un mensaje emergente personalizado en recuadro uniforme redondeado ("DM Sans").
 */
export function mostrarAlerta(entrada) {
  return encolarDialogo(entrada, false);
}

/**
 * Muestra un diálogo de confirmación personalizado con dos botones y retorna Promise<boolean>.
 */
export function mostrarConfirmacion(entrada) {
  return encolarDialogo(entrada, true);
}

function renderIconoAlerta(tipo) {
  if (tipo === 'favoritos') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  if (tipo === 'exito') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (tipo === 'aviso') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  if (tipo === 'error') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  if (tipo === 'confirmar') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function AlertaProvider({ children }) {
  const router = useRouter();
  const [cola, setCola] = useState(() => colaPendiente.splice(0, colaPendiente.length));

  const agregarACola = useCallback((item) => {
    setCola((prev) => [...prev, item]);
  }, []);

  useEffect(() => {
    despachadorGlobal = agregarACola;

    // Interceptar window.alert para garantizar que cualquier alerta use el recuadro DM Sans
    const alertNativo = window.alert;
    window.alert = (mensaje) => {
      mostrarAlerta(String(mensaje ?? ''));
    };

    return () => {
      if (despachadorGlobal === agregarACola) {
        despachadorGlobal = null;
      }
      window.alert = alertNativo;
    };
  }, [agregarACola]);

  const actual = cola[0] || null;

  const cerrarActual = useCallback((resultado) => {
    setCola((prev) => {
      const [primero, ...resto] = prev;
      if (primero?.resolve) {
        primero.resolve(resultado);
      }
      return resto;
    });
  }, []);

  const manejarConfirmar = useCallback(() => {
    const destino = actual?.hrefConfirmar;
    cerrarActual(true);
    if (destino) {
      router.push(destino);
    }
  }, [actual, cerrarActual, router]);

  const manejarCancelar = useCallback(() => {
    cerrarActual(false);
  }, [cerrarActual]);

  useEffect(() => {
    if (!actual) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cerrarActual(actual.esConfirmacion ? false : true);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        manejarConfirmar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actual, cerrarActual, manejarConfirmar]);

  return (
    <AlertaContext.Provider value={{ mostrarAlerta, mostrarConfirmacion }}>
      {children}

      {actual && (
        <div
          className="alerta-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="alerta-titulo"
          onClick={() => cerrarActual(actual.esConfirmacion ? false : true)}
        >
          <div className="alerta-box" onClick={(e) => e.stopPropagation()}>
            <div className="alerta-cuerpo">
              <div className={`alerta-icono alerta-icono-${actual.tipo || 'info'}`}>
                {renderIconoAlerta(actual.tipo)}
              </div>
              <h3 id="alerta-titulo" className="alerta-titulo">
                {actual.titulo}
              </h3>
              <p className="alerta-mensaje">{actual.mensaje}</p>
            </div>

            <div className="alerta-acciones">
              {actual.textoCancelar && (
                <button
                  type="button"
                  className="alerta-btn-secundario"
                  onClick={manejarCancelar}
                >
                  {actual.textoCancelar}
                </button>
              )}
              <button
                type="button"
                className="alerta-btn-primario"
                onClick={manejarConfirmar}
                autoFocus
              >
                {actual.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertaContext.Provider>
  );
}

export function useAlerta() {
  return useContext(AlertaContext);
}
