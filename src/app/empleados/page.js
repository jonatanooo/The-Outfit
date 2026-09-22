"use client"
import { useEffect, useState } from 'react'
import SidebarAdmin from '@/components/SidebarAdmin'
import { supabase } from '@/lib/supabaseClient'
import './Empleados.css'

const PUESTOS = ['Empleado'];

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

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [modalAbierto, setModalAbierto] = useState(null); // null | 'agregar' | 'editar'
  const [empleadoEditando, setEmpleadoEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  useEffect(() => {
    cargarEmpleados();
  }, []);

  async function cargarEmpleados() {
    setCargando(true);
    const { data, error } = await supabase
      .from('User')
      .select('ID_User, Nombres, Apellidos, DUI, Correo, Puesto, ID_EstadoUsuario, Fecha_Incorporacion')
      .eq('Es_Empleado', true)
      .order('ID_User');

    if (error) {
      console.error('Error cargando empleados:', error.message);
      setEmpleados([]);
    } else {
      setEmpleados(data ?? []);
    }
    setCargando(false);
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
      nombres: emp.Nombres || '',
      apellidos: emp.Apellidos || '',
      correo: emp.Correo || '',
      dui: emp.DUI || '',
      puesto: emp.Puesto || 'Empleado',
    });
    setErrorForm('');
    setModalAbierto('editar');
  }

  function cerrarModal() {
    setModalAbierto(null);
    setEmpleadoEditando(null);
  }

  function validarForm() {
    if (!form.nombres.trim() || !form.apellidos.trim()) return 'Nombres y apellidos son obligatorios.';
    if (!form.correo.trim() || !/\S+@\S+\.\S+/.test(form.correo)) return 'Correo inválido.';
    if (!/^\d{8}-\d$/.test(form.dui)) return 'DUI inválido, formato 12345678-9.';
    return '';
  }

  async function guardarNuevo() {
    const error = validarForm();
    if (error) { setErrorForm(error); return; }

    setGuardando(true);
    const { error: errorInsert } = await supabase.from('User').insert({
      Nombres: form.nombres.trim(),
      Apellidos: form.apellidos.trim(),
      Correo: form.correo.trim(),
      Usuario: `${form.nombres.trim()} ${form.apellidos.trim()}`,
      DUI: form.dui,
      Puesto: form.puesto,
      Es_Empleado: true,
      ID_EstadoUsuario: 1,
      Fecha_Incorporacion: new Date().toISOString(),
    });
    setGuardando(false);

    if (errorInsert) {
      setErrorForm('No se pudo agregar: ' + errorInsert.message);
      return;
    }
    cerrarModal();
    cargarEmpleados();
  }

  async function guardarEdicion() {
    const error = validarForm();
    if (error) { setErrorForm(error); return; }

    setGuardando(true);
    const { error: errorUpdate } = await supabase
      .from('User')
      .update({
        Nombres: form.nombres.trim(),
        Apellidos: form.apellidos.trim(),
        Correo: form.correo.trim(),
        Usuario: `${form.nombres.trim()} ${form.apellidos.trim()}`,
        DUI: form.dui,
        Puesto: form.puesto,
      })
      .eq('ID_User', empleadoEditando.ID_User);
    setGuardando(false);

    if (errorUpdate) {
      setErrorForm('No se pudo guardar: ' + errorUpdate.message);
      return;
    }
    cerrarModal();
    cargarEmpleados();
  }

  async function alternarEstado(emp) {
    const nuevoEstado = emp.ID_EstadoUsuario === 1 ? 2 : 1;
    const accion = nuevoEstado === 2 ? 'desactivar' : 'activar';
    const nombre = `${emp.Nombres ?? ''} ${emp.Apellidos ?? ''}`.trim() || `#${emp.ID_User}`;

    if (!confirm(`¿Seguro que deseas ${accion} a ${nombre}?`)) return;

    const { error } = await supabase
      .from('User')
      .update({ ID_EstadoUsuario: nuevoEstado })
      .eq('ID_User', emp.ID_User);

    if (error) {
      alert('No se pudo cambiar el estado: ' + error.message);
    } else {
      cargarEmpleados();
    }
  }

  return (
    <>
      <div className="admin-layout">
        <SidebarAdmin />

        <main className="admin-content">
          <p className="empleados-breadcrumb">
            {modalAbierto === 'editar' ? 'Editar empleado' : 'Empleados'}
          </p>

          <div className="admin-top">
            <h1>Empleado</h1>
            <button className="btn-agregar" onClick={abrirAgregar}>
              + Agregar empleado
            </button>
          </div>

          <input
            className="buscador"
            placeholder="Buscar empleado"
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
                      <td>{emp.Puesto || 'Empleado'}</td>
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
