"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SidebarAdmin from '@/components/SidebarAdmin'
import { db, auth } from '@/lib/firebaseClient'
import { sendPasswordResetEmail } from 'firebase/auth'
import { useAuth } from '@/lib/AuthContext'
import { verificarAccesoServidor, obtenerIdUsuario } from '@/lib/usuario'
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  query,
  where
} from 'firebase/firestore'
import './Empleados.css'

const PUESTOS = ['Empleado', 'Usuario normal'];

// Igual que en register/page.js: deja solo dígitos y mete el guion después del 8vo.
function formatearDui(valor) {
  const soloDigitos = valor.replace(/\D/g, '').slice(0, 9);
  return soloDigitos.length > 8
    ? `${soloDigitos.slice(0, 8)}-${soloDigitos.slice(8)}`
    : soloDigitos;
}

function formatearFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const FORM_VACIO = { nombres: '', apellidos: '', correo: '', dui: '', puesto: 'Empleado' };

async function actualizarUser(idUser, campos) {
  if (idUser == null) return;
  try {
    const docRef = doc(db, 'User', String(idUser));
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, campos);
      return;
    }
    const opciones = [idUser, String(idUser)];
    if (!isNaN(Number(idUser))) opciones.push(Number(idUser));
    const q = query(collection(db, 'User'), where('ID_User', 'in', Array.from(new Set(opciones))));
    const res = await getDocs(q);
    if (!res.empty) {
      await updateDoc(res.docs[0].ref, campos);
    }
  } catch (err) {
    console.error('Error al actualizar usuario:', err);
    throw err;
  }
}

export default function EmpleadosPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [modalAbierto, setModalAbierto] = useState(null); // null | 'agregar' | 'editar'
  const [empleadoEditando, setEmpleadoEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  useEffect(() => {
    if (authLoading) return;

    let activo = true;
    async function verificar() {
      const acceso = await verificarAccesoServidor('admin');
      if (!activo) return;
      if (!acceso.autorizado) {
        router.replace(acceso.rol === 'anonimo' ? '/login' : '/');
        return;
      }

      setVerificandoAcceso(false);
      await cargarEmpleados();
    }

    verificar();
    return () => { activo = false; };
  }, [authLoading, router]);

  async function cargarEmpleados() {
    setCargando(true);
    try {
      const snap = await getDocs(collection(db, 'User'));
      const list = snap.docs
        .filter((d) => d.id !== '_schema_init' && d.id !== '_placeholder' && !d.data()?._is_schema_template)
        .map((d) => {
          const data = d.data();
          return {
            ...data,
            ID_User: data.ID_User ?? d.id,
            _docId: d.id,
          };
        });
      list.sort((a, b) => (Number(a.ID_User) || 0) - (Number(b.ID_User) || 0));
      setEmpleados(list);
    } catch (err) {
      console.error('Error cargando usuarios desde Firestore:', err);
      setEmpleados([]);
    } finally {
      setCargando(false);
    }
  }

  const filtrados = empleados.filter((e) =>
    `${e.Nombres ?? ''} ${e.Apellidos ?? ''}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  function abrirAgregar() {
    setForm(FORM_VACIO);
    setErrorForm('');
    setModalAbierto('agregar');
  }

  function abrirEditar(emp) {
    setEmpleadoEditando(emp);
    setForm({
      nombres: emp.Nombres ?? '',
      apellidos: emp.Apellidos ?? '',
      correo: emp.Correo ?? '',
      dui: emp.DUI ?? '',
      puesto: emp.Puesto || (emp.Es_Empleado ? 'Empleado' : 'Usuario normal'),
    });
    setErrorForm('');
    setModalAbierto('editar');
  }

  function cerrarModal() {
    setModalAbierto(null);
    setEmpleadoEditando(null);
    setErrorForm('');
  }

  function validarForm() {
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.correo.trim() || !form.dui.trim()) {
      return 'Todos los campos son obligatorios.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.correo)) {
      return 'El correo no es válido.';
    }
    if (form.dui.length !== 10) {
      return 'El DUI debe tener 10 caracteres (ej. 12345678-9).';
    }
    return '';
  }

  async function guardarNuevo() {
    const error = validarForm();
    if (error) { setErrorForm(error); return; }

    setGuardando(true);
    setErrorForm('');

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/empleados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          correo: form.correo.trim(),
          dui: form.dui,
          puesto: form.puesto,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorForm(data.error || 'No se pudo crear el usuario.');
        setGuardando(false);
        return;
      }

      // Disparar envío oficial del correo de restablecimiento de contraseña de Firebase Auth
      try {
        await sendPasswordResetEmail(auth, form.correo.trim());
      } catch (errMail) {
        console.warn('Aviso al enviar correo de restablecimiento:', errMail.message);
      }

      cerrarModal();
      await cargarEmpleados();
      alert(
        `Usuario creado de forma segura sin contraseña en texto plano.\nSe envió un enlace de configuración de contraseña a ${form.correo.trim()}.`
      );
    } catch (err) {
      console.error('Error creando usuario:', err);
      setErrorForm('No se pudo crear: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion() {
    const error = validarForm();
    if (error) { setErrorForm(error); return; }

    setGuardando(true);

    try {
      if (form.dui !== empleadoEditando.DUI) {
        const qDui = query(collection(db, 'User'), where('DUI', '==', form.dui));
        const snapDui = await getDocs(qDui);
        const repetido = snapDui.docs.find((d) => {
          const data = d.data();
          const id = data.ID_User ?? d.id;
          return String(id) !== String(empleadoEditando.ID_User);
        });

        if (repetido) {
          setErrorForm('No se puede actualizar. Ese DUI ya está registrado para otro usuario.');
          setGuardando(false);
          return;
        }
      }

      const puestoAnterior = empleadoEditando.Puesto || (empleadoEditando.Es_Empleado ? 'Empleado' : 'Usuario normal');
      const rolAnteriorId = Number(empleadoEditando.ID_Rol ?? (empleadoEditando.Es_Empleado ? 2 : 3));
      const esEmpleadoNuevo = form.puesto === 'Empleado';
      const rolNuevoId = esEmpleadoNuevo ? 2 : 3;

      await actualizarUser(empleadoEditando.ID_User, {
        Nombres: form.nombres.trim(),
        Apellidos: form.apellidos.trim(),
        Correo: form.correo.trim(),
        Usuario: `${form.nombres.trim()} ${form.apellidos.trim()}`,
        DUI: form.dui,
        Puesto: form.puesto,
        ID_Rol: rolNuevoId,
        Es_Empleado: esEmpleadoNuevo
      });

      // Registrar en Auditoria_Actualizacion_User y (si cambió el rol) en Auditoria_CambioRol
      try {
        const idUserAccion = (await obtenerIdUsuario()) || auth.currentUser?.uid || 'Admin';
        const adminEmail = auth.currentUser?.email || 'Admin Desconocido';
        const ahoraIso = new Date().toISOString();
        const datosAnteriores = `Nombre: ${empleadoEditando.Nombres} ${empleadoEditando.Apellidos}, Correo: ${empleadoEditando.Correo || ''}, DUI: ${empleadoEditando.DUI}, Rol: ${puestoAnterior}`;
        const datosNuevos = `Nombre: ${form.nombres.trim()} ${form.apellidos.trim()}, Correo: ${form.correo.trim()}, DUI: ${form.dui}, Rol: ${form.puesto}`;

        const auditUserRef = doc(collection(db, 'Auditoria_Actualizacion_User'));
        await setDoc(auditUserRef, {
          ID_Auditoria: auditUserRef.id,
          ID_User: empleadoEditando.ID_User,
          ID_UserAccion: idUserAccion,
          Usuario_Admin: adminEmail,
          ValorAntiguo: datosAnteriores,
          ValorNuevo: datosNuevos,
          Fecha_Registro: ahoraIso
        });

        if (puestoAnterior !== form.puesto || rolAnteriorId !== rolNuevoId) {
          const auditRolRef = doc(collection(db, 'Auditoria_CambioRol'));
          await setDoc(auditRolRef, {
            ID_Auditoria: auditRolRef.id,
            ID_User: empleadoEditando.ID_User,
            ID_UserAccion: idUserAccion,
            Usuario_Admin: adminEmail,
            ID_RolAntiguo: rolAnteriorId,
            ID_RolNuevo: rolNuevoId,
            Rol_Antiguo: puestoAnterior,
            Rol_Nuevo: form.puesto,
            Fecha_Registro: ahoraIso
          });
        }
      } catch (errAudit) {
        console.log('No se pudo guardar en auditoría:', errAudit);
      }

      cerrarModal();
      cargarEmpleados();
    } catch (err) {
      console.error('Error al editar usuario:', err);
      setErrorForm('No se pudo guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function alternarEstado(emp) {
    const nuevoEstado = emp.ID_EstadoUsuario === 1 ? 2 : 1;
    const accion = nuevoEstado === 2 ? 'desactivar' : 'activar';
    const nombre = `${emp.Nombres ?? ''} ${emp.Apellidos ?? ''}`.trim() || `#${emp.ID_User}`;

    if (!confirm(`¿Seguro que deseas ${accion} a ${nombre}?`)) return;

    try {
      if (nuevoEstado === 2) {
        const estRef = doc(db, 'Estado_User', '2');
        const snapEst = await getDoc(estRef);
        if (!snapEst.exists()) {
          await setDoc(estRef, { ID_EstadoUsuario: 2, Estado: 'Baneado' });
        }
      }

      const estadoAnterior = Number(emp.ID_EstadoUsuario ?? 1);

      // Sincronizar en servidor (deshabilita/habilita cuenta en Firebase Auth, revoca tokens y registra en Auditoria_CambioEstado_User)
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch('/api/admin/empleados', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ idUser: emp.ID_User, nuevoEstado }),
      });

      if (!res.ok) {
        await actualizarUser(emp.ID_User, { ID_EstadoUsuario: nuevoEstado });
        try {
          const idUserAccion = (await obtenerIdUsuario()) || auth.currentUser?.uid || 'Admin';
          const auditEstadoRef = doc(collection(db, 'Auditoria_CambioEstado_User'));
          await setDoc(auditEstadoRef, {
            ID_Auditoria: auditEstadoRef.id,
            ID_User: emp.ID_User,
            ID_UserAccion: idUserAccion,
            ID_EstadoAnterior: estadoAnterior,
            ID_EstadoNuevo: nuevoEstado,
            Fecha_Registro: new Date().toISOString()
          });
        } catch (errAuditEst) {
          console.error('Error guardando Auditoria_CambioEstado_User:', errAuditEst);
        }
      }

      cargarEmpleados();
    } catch (error) {
      alert('No se pudo cambiar el estado: ' + error.message);
    }
  }

  if (verificandoAcceso) {
    return null;
  }

  return (
    <>
      <div className="admin-layout">
        <SidebarAdmin />

        <main className="admin-content">
          <div className="admin-top">
            <h1>Usuarios</h1>
            <button className="btn-agregar" onClick={abrirAgregar}>
              + Agregar usuario
            </button>
          </div>

          <input
            className="buscador"
            placeholder="Buscar usuario"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {cargando ? (
            <p>Cargando empleados...</p>
          ) : (
            <table className="tabla-productos">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Sucursal</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((emp) => {
                  const activo = emp.ID_EstadoUsuario === 1;
                  return (
                    <tr key={emp.ID_User} style={{ opacity: activo ? 1 : 0.6 }}>
                      <td>{emp.ID_User}</td>
                      <td>{emp.Nombres}</td>
                      <td className="empleados-correo">{emp.Correo || '—'}</td>
                      <td>{emp.Puesto || (emp.Es_Empleado ? 'Empleado' : 'Usuario normal')}</td>
                      <td className="empleados-sucursal">Antiguo C.</td>
                      <td className={activo ? 'empleados-activo' : 'empleados-inactivo'}>
                        {activo ? 'Activo' : 'Inactivo'}
                      </td>
                      <td>
                        <div className="empleados-acciones">
                          <button type="button" title="Editar" onClick={() => abrirEditar(emp)}>
                            ✏️
                          </button>
                          <button
                            type="button"
                            title={activo ? 'Desactivar' : 'Reactivar'}
                            onClick={() => alternarEstado(emp)}
                          >
                            {activo ? '🚫' : '↻'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#777' }}>
                      No hay empleados para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </main>
      </div>

      {(modalAbierto === 'agregar' || modalAbierto === 'editar') && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-box empleados-modal" onClick={(e) => e.stopPropagation()}>
            <div className="empleados-modal-header">
              <div>
                <h2>{modalAbierto === 'editar' ? `Empleado #${empleadoEditando?.ID_User}` : 'Nuevo empleado'}</h2>
                {modalAbierto === 'editar' && (
                  <p className="empleados-incorporacion">
                    Incorporación {formatearFecha(empleadoEditando?.Fecha_Incorporacion)}
                  </p>
                )}
              </div>

              {modalAbierto === 'editar' && (
                <span className={`empleados-badge ${empleadoEditando.ID_EstadoUsuario === 1 ? 'activo' : 'inactivo'}`}>
                  {empleadoEditando.ID_EstadoUsuario === 1 ? 'ACTIVO' : 'INACTIVO'}
                </span>
              )}

              <button type="button" onClick={cerrarModal} aria-label="Cerrar">✕</button>
            </div>

            <div className="empleados-modal-body">
              <div className="empleados-modal-campos">
                <label>Nombres</label>
                <input
                  value={form.nombres}
                  onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
                />

                <label>Apellidos</label>
                <input
                  value={form.apellidos}
                  onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
                />

                <label>Correo</label>
                <input
                  type="email"
                  value={form.correo}
                  placeholder="correo@ejemplo.com"
                  onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
                />

                <label>DUI</label>
                <input
                  value={form.dui}
                  placeholder="12345678-9"
                  maxLength={10}
                  onChange={(e) => setForm((f) => ({ ...f, dui: formatearDui(e.target.value) }))}
                />

                <label>Rol</label>
                <select
                  value={form.puesto}
                  onChange={(e) => setForm((f) => ({ ...f, puesto: e.target.value }))}
                >
                  {PUESTOS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="empleados-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
                </svg>
              </div>
            </div>

            {errorForm && <p className="empleados-error">{errorForm}</p>}

            <button
              type="button"
              className="btn-guardar"
              onClick={modalAbierto === 'editar' ? guardarEdicion : guardarNuevo}
              disabled={guardando}
            >
              {guardando ? 'Guardando...' : modalAbierto === 'editar' ? 'Guardar cambios' : 'Agregar empleado'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
