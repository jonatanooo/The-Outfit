"use client";
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import SidebarAdmin from '@/components/SidebarAdmin';
import { db, auth } from '@/lib/firebaseClient';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '@/lib/AuthContext';
import {
  verificarAccesoServidor,
  obtenerIdUsuario,
  esRegistroEmpleadoOAdmin,
} from '@/lib/usuario';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import './Usuarios.css';

const ROLES_CATALOGO = [
  { id: 1, label: 'Administrador', puesto: 'Administrador', esEmpleado: true },
  { id: 2, label: 'Empleado', puesto: 'Empleado', esEmpleado: true },
  { id: 3, label: 'Cliente (Usuario normal)', puesto: 'Usuario normal', esEmpleado: false },
];

function resolverIdRolUsuario(u) {
  if (!u) return 3;
  const idRolNum = Number(u.ID_Rol);
  if (idRolNum === 1 || idRolNum === 2 || idRolNum === 3) {
    return idRolNum;
  }
  const puesto = String(u.Puesto || u.Rol || '').trim().toLowerCase();
  if (puesto === 'admin' || puesto === 'administrador') return 1;
  if (u.Es_Empleado === true || puesto === 'empleado') return 2;
  return 3;
}

function obtenerInfoRol(idRol) {
  const num = Number(idRol);
  return ROLES_CATALOGO.find((r) => r.id === num) || ROLES_CATALOGO[2];
}

// Formatea el DUI como "12345678-9"
function formatearDui(valor) {
  const soloDigitos = String(valor || '').replace(/\D/g, '').slice(0, 9);
  return soloDigitos.length > 8
    ? `${soloDigitos.slice(0, 8)}-${soloDigitos.slice(8)}`
    : soloDigitos;
}

function formatearTelefono(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

function formatearFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-SV', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

const FORM_VACIO = {
  nombres: '',
  apellidos: '',
  usuario: '',
  correo: '',
  telefono: '',
  dui: '',
  idRol: 2,
  nuevaPassword: '',
};

async function actualizarDocumentoUser(usuarioObj, campos) {
  if (!usuarioObj) return;
  const idUser = usuarioObj.ID_User;
  const docId = usuarioObj._docId;
  let docPrimarioActualizado = null;

  try {
    if (docId) {
      const refDirecto = doc(db, 'User', String(docId));
      const snapDirecto = await getDoc(refDirecto);
      if (snapDirecto.exists()) {
        await updateDoc(refDirecto, campos);
        docPrimarioActualizado = snapDirecto.id;
      }
    }

    if (!docPrimarioActualizado && idUser != null) {
      const docRef = doc(db, 'User', String(idUser));
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await updateDoc(docRef, campos);
        docPrimarioActualizado = snap.id;
      } else {
        const opciones = [idUser, String(idUser)];
        if (!isNaN(Number(idUser))) opciones.push(Number(idUser));
        const q = query(
          collection(db, 'User'),
          where('ID_User', 'in', Array.from(new Set(opciones)))
        );
        const res = await getDocs(q);
        if (!res.empty) {
          await updateDoc(res.docs[0].ref, campos);
          docPrimarioActualizado = res.docs[0].id;
        }
      }
    }

    // Si se actualizó rol o estado, sincronizar también cualquier registro duplicado con el mismo Correo o auth_id
    const correoBuscar = (campos.Correo || usuarioObj.Correo || '').trim().toLowerCase();
    if (correoBuscar && (campos.ID_Rol != null || campos.ID_EstadoUsuario != null)) {
      const camposRolEstado = {};
      if (campos.ID_Rol != null) camposRolEstado.ID_Rol = campos.ID_Rol;
      if (campos.Puesto != null) camposRolEstado.Puesto = campos.Puesto;
      if (campos.Es_Empleado != null) camposRolEstado.Es_Empleado = campos.Es_Empleado;
      if (campos.ID_EstadoUsuario != null) camposRolEstado.ID_EstadoUsuario = campos.ID_EstadoUsuario;

      const qCorreo = query(collection(db, 'User'), where('Correo', '==', correoBuscar));
      const snapCorreo = await getDocs(qCorreo);
      for (const d of snapCorreo.docs) {
        if (d.id !== docPrimarioActualizado && d.id !== '_schema_init' && d.id !== '_placeholder') {
          await updateDoc(d.ref, camposRolEstado).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('Error al actualizar usuario en Firestore:', err);
    throw err;
  }
}

export default function UsuariosPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);

  // Pestaña activa: 'todos' ("Todos los Usuarios / Clientes") | 'empleados' ("Empleados")
  const [pestanaActiva, setPestanaActiva] = useState('todos');
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Estado del Modal ('agregar' | 'editar' | null)
  const [modalAbierto, setModalAbierto] = useState(null);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [mensajeExitoModal, setMensajeExitoModal] = useState('');

  // Guard estricto de acceso al Panel de Administración
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
      await cargarUsuarios();
    }

    verificar();
    return () => {
      activo = false;
    };
  }, [authUser, authLoading, router]);

  async function cargarUsuarios() {
    setCargando(true);
    try {
      const snap = await getDocs(collection(db, 'User'));
      const list = snap.docs
        .filter(
          (d) =>
            d.id !== '_schema_init' &&
            d.id !== '_placeholder' &&
            !d.data()?._is_schema_template &&
            !d.data()?._info
        )
        .map((d) => {
          const data = d.data();
          const idRolNormalizado = resolverIdRolUsuario(data);
          return {
            ...data,
            ID_User: data.ID_User ?? d.id,
            ID_Rol: idRolNormalizado,
            Es_Empleado: idRolNormalizado === 1 || idRolNormalizado === 2 || data.Es_Empleado === true,
            _docId: d.id,
          };
        });

      list.sort((a, b) => {
        const numA = Number(a.ID_User);
        const numB = Number(b.ID_User);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a.ID_User).localeCompare(String(b.ID_User));
      });

      setUsuarios(list);
    } catch (err) {
      console.error('Error cargando usuarios desde Firestore:', err);
      setUsuarios([]);
    } finally {
      setCargando(false);
    }
  }

  // Lista filtrada exclusivamente de Empleados / Administradores (Pestaña 2)
  const listaEmpleados = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          Number(u.ID_Rol) === 1 ||
          Number(u.ID_Rol) === 2 ||
          u.Es_Empleado === true ||
          esRegistroEmpleadoOAdmin(u)
      ),
    [usuarios]
  );

  // Registros correspondientes a la pestaña activa + filtro de búsqueda
  const usuariosMostrados = useMemo(() => {
    const base = pestanaActiva === 'empleados' ? listaEmpleados : usuarios;
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return base;

    return base.filter((u) => {
      const nombreCompleto = `${u.Nombres ?? ''} ${u.Apellidos ?? ''}`.toLowerCase();
      const correo = String(u.Correo ?? '').toLowerCase();
      const username = String(u.Usuario ?? '').toLowerCase();
      const dui = String(u.DUI ?? '').toLowerCase();
      const tel = String(u.Telefono ?? '').toLowerCase();
      const idStr = String(u.ID_User ?? '').toLowerCase();
      return (
        nombreCompleto.includes(termino) ||
        correo.includes(termino) ||
        username.includes(termino) ||
        dui.includes(termino) ||
        tel.includes(termino) ||
        idStr.includes(termino)
      );
    });
  }, [usuarios, listaEmpleados, pestanaActiva, busqueda]);

  function abrirAgregar() {
    setUsuarioEditando(null);
    setForm({
      ...FORM_VACIO,
      idRol: pestanaActiva === 'empleados' ? 2 : 3,
    });
    setMostrarPassword(false);
    setErrorForm('');
    setMensajeExitoModal('');
    setModalAbierto('agregar');
  }

  function abrirEditar(u) {
    const idRolActual = resolverIdRolUsuario(u);
    setUsuarioEditando(u);
    setForm({
      nombres: u.Nombres ?? '',
      apellidos: u.Apellidos ?? '',
      usuario: u.Usuario ?? '',
      correo: u.Correo ?? '',
      telefono: u.Telefono ?? '',
      dui: u.DUI ?? '',
      idRol: idRolActual,
      nuevaPassword: '',
    });
    setMostrarPassword(false);
    setErrorForm('');
    setMensajeExitoModal('');
    setModalAbierto('editar');
  }

  function cerrarModal() {
    setModalAbierto(null);
    setUsuarioEditando(null);
    setErrorForm('');
    setMensajeExitoModal('');
  }

  function validarFormulario(esNuevo = false) {
    if (!form.nombres.trim()) {
      return 'El campo Nombres es obligatorio.';
    }
    if (!form.correo.trim()) {
      return 'El campo Correo es obligatorio.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.correo.trim())) {
      return 'El correo electrónico no tiene un formato válido.';
    }

    const duiLimpio = form.dui.trim();
    if (esNuevo && !duiLimpio) {
      return 'El DUI es obligatorio para registrar un usuario.';
    }
    if (duiLimpio && !/^\d{8}-\d$/.test(duiLimpio)) {
      return 'El DUI debe tener el formato 12345678-9 (10 caracteres).';
    }

    const telLimpio = form.telefono.trim();
    if (telLimpio && !/^\d{8}$/.test(telLimpio)) {
      return 'El teléfono debe contener exactamente 8 dígitos numéricos.';
    }

    if (form.nuevaPassword && form.nuevaPassword.length < 6) {
      return 'La nueva contraseña debe tener al menos 6 caracteres.';
    }

    return '';
  }

  /**
   * Consulta a Firestore (where("DUI", "==", nuevoDUI)) para verificar si el DUI
   * ya pertenece a otro ID_User distinto al que se está editando/creando.
   */
  async function verificarDuiDuplicadoEnFirestore(nuevoDUI, idUserActual = null, docIdActual = null) {
    const duiTrim = String(nuevoDUI || '').trim();
    if (!duiTrim) return false;

    const qDui = query(collection(db, 'User'), where('DUI', '==', duiTrim));
    const snapDui = await getDocs(qDui);

    const conflicto = snapDui.docs.find((d) => {
      if (d.id === '_schema_init' || d.id === '_placeholder' || d.data()?._is_schema_template) {
        return false;
      }
      const data = d.data();
      const idDocUser = data.ID_User ?? d.id;
      if (idUserActual != null && String(idDocUser) === String(idUserActual)) {
        return false;
      }
      if (docIdActual != null && String(d.id) === String(docIdActual)) {
        return false;
      }
      return true;
    });

    return Boolean(conflicto);
  }

  async function guardarNuevo() {
    const errorValidacion = validarFormulario(true);
    if (errorValidacion) {
      setErrorForm(errorValidacion);
      return;
    }

    setGuardando(true);
    setErrorForm('');
    setMensajeExitoModal('');

    try {
      // Validación estricta de DUI único en Firestore antes de crear
      const duiDuplicado = await verificarDuiDuplicadoEnFirestore(form.dui.trim());
      if (duiDuplicado) {
        setErrorForm('Error: Este DUI ya está registrado en otro usuario.');
        setGuardando(false);
        return;
      }

      const idToken = await auth.currentUser?.getIdToken();
      const infoRol = obtenerInfoRol(form.idRol);

      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          usuario: form.usuario.trim() || form.correo.trim().split('@')[0],
          correo: form.correo.trim().toLowerCase(),
          telefono: form.telefono.trim() || null,
          dui: form.dui.trim(),
          idRol: Number(form.idRol),
          puesto: infoRol.puesto,
          password: form.nuevaPassword || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorForm(data.error || 'No se pudo crear el usuario.');
        setGuardando(false);
        return;
      }

      if (!form.nuevaPassword) {
        try {
          await sendPasswordResetEmail(auth, form.correo.trim().toLowerCase());
        } catch (errMail) {
          console.warn('Aviso al enviar correo de restablecimiento:', errMail.message);
        }
      }

      cerrarModal();
      await cargarUsuarios();
      alert(
        form.nuevaPassword
          ? `Usuario ${form.nombres.trim()} creado exitosamente con su contraseña asignada.`
          : `Usuario creado exitosamente.\nSe envió un enlace de configuración de contraseña a ${form.correo.trim()}.`
      );
    } catch (err) {
      console.error('Error creando usuario:', err);
      setErrorForm('No se pudo crear el usuario: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion() {
    if (!usuarioEditando) return;

    const errorValidacion = validarFormulario(false);
    if (errorValidacion) {
      setErrorForm(errorValidacion);
      return;
    }

    setGuardando(true);
    setErrorForm('');
    setMensajeExitoModal('');

    try {
      const nuevoDUI = form.dui.trim();

      // Regla de Validación del DUI antes de hacer UPDATE en la colección User
      if (nuevoDUI) {
        const existeEnOtroUsuario = await verificarDuiDuplicadoEnFirestore(
          nuevoDUI,
          usuarioEditando.ID_User,
          usuarioEditando._docId
        );
        if (existeEnOtroUsuario) {
          setErrorForm('Error: Este DUI ya está registrado en otro usuario.');
          setGuardando(false);
          return;
        }
      }

      const rolAnteriorId = resolverIdRolUsuario(usuarioEditando);
      const infoRolAnterior = obtenerInfoRol(rolAnteriorId);

      const rolNuevoId = Number(form.idRol);
      const infoRolNuevo = obtenerInfoRol(rolNuevoId);
      const esEmpleadoNuevo = infoRolNuevo.esEmpleado;

      const usernameFinal =
        form.usuario.trim() ||
        usuarioEditando.Usuario ||
        `${form.nombres.trim()} ${form.apellidos.trim()}`.trim();

      const camposActualizados = {
        Nombres: form.nombres.trim(),
        Apellidos: form.apellidos.trim(),
        Usuario: usernameFinal,
        Correo: form.correo.trim().toLowerCase(),
        Telefono: form.telefono.trim() || null,
        DUI: nuevoDUI || null,
        Puesto: infoRolNuevo.puesto,
        ID_Rol: rolNuevoId,
        Es_Empleado: esEmpleadoNuevo,
      };

      // 1. Actualizar documento en la colección User de Firestore
      await actualizarDocumentoUser(usuarioEditando, camposActualizados);

      // 2. Sincronizar con el servidor (Custom Claims en Firebase Auth + cambio de contraseña directo si se ingresó)
      let passwordActualizadaEnAuth = false;
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const resPut = await fetch('/api/admin/usuarios', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({
            idUser: usuarioEditando.ID_User,
            docId: usuarioEditando._docId,
            authId: usuarioEditando.auth_id,
            nombres: camposActualizados.Nombres,
            apellidos: camposActualizados.Apellidos,
            usuario: camposActualizados.Usuario,
            correo: camposActualizados.Correo,
            telefono: camposActualizados.Telefono,
            dui: camposActualizados.DUI,
            idRol: rolNuevoId,
            nuevaPassword: form.nuevaPassword || undefined,
          }),
        });

        const dataPut = await resPut.json().catch(() => ({}));
        if (resPut.status === 409 && dataPut?.error) {
          setErrorForm(dataPut.error);
          setGuardando(false);
          return;
        }
        if (dataPut?.passwordActualizadaDirecta) {
          passwordActualizadaEnAuth = true;
        }
      } catch (errServerSync) {
        console.warn('Sincronización secundaria con endpoint /api/admin/usuarios:', errServerSync);
      }

      // Si el administrador ingresó una nueva contraseña y el entorno no tenía Admin SDK para cambio directo,
      // enviamos automáticamente el correo de restablecimiento de Firebase Auth como respaldo seguro.
      if (form.nuevaPassword && !passwordActualizadaEnAuth && camposActualizados.Correo) {
        try {
          await sendPasswordResetEmail(auth, camposActualizados.Correo);
        } catch (errReset) {
          console.warn('No se pudo enviar correo de restablecimiento:', errReset);
        }
      }

      // 3. Registrar en Auditoria_Actualizacion_User y Auditoria_CambioRol
      try {
        const idUserAccion = (await obtenerIdUsuario()) || auth.currentUser?.uid || 'Admin';
        const adminEmail = auth.currentUser?.email || 'Admin';
        const ahoraIso = new Date().toISOString();

        const valorAntiguo = `Nombre: ${usuarioEditando.Nombres || ''} ${usuarioEditando.Apellidos || ''}, Correo: ${usuarioEditando.Correo || ''}, Tel: ${usuarioEditando.Telefono || '—'}, DUI: ${usuarioEditando.DUI || '—'}, Rol: ${infoRolAnterior.label} (ID_Rol: ${rolAnteriorId})`;
        const valorNuevo = `Nombre: ${camposActualizados.Nombres} ${camposActualizados.Apellidos}, Correo: ${camposActualizados.Correo}, Tel: ${camposActualizados.Telefono || '—'}, DUI: ${camposActualizados.DUI || '—'}, Rol: ${infoRolNuevo.label} (ID_Rol: ${rolNuevoId})${form.nuevaPassword ? ' [Contraseña actualizada]' : ''}`;

        const auditUserRef = doc(collection(db, 'Auditoria_Actualizacion_User'));
        await setDoc(auditUserRef, {
          ID_Auditoria: auditUserRef.id,
          ID_User: usuarioEditando.ID_User,
          ID_UserAccion: idUserAccion,
          Usuario_Admin: adminEmail,
          ValorAntiguo: valorAntiguo,
          ValorNuevo: valorNuevo,
          Fecha_Registro: ahoraIso,
        });

        if (rolAnteriorId !== rolNuevoId) {
          const auditRolRef = doc(collection(db, 'Auditoria_CambioRol'));
          await setDoc(auditRolRef, {
            ID_Auditoria: auditRolRef.id,
            ID_User: usuarioEditando.ID_User,
            ID_UserAccion: idUserAccion,
            Usuario_Admin: adminEmail,
            ID_RolAntiguo: rolAnteriorId,
            ID_RolNuevo: rolNuevoId,
            Rol_Antiguo: infoRolAnterior.label,
            Rol_Nuevo: infoRolNuevo.label,
            Fecha_Registro: ahoraIso,
          });
        }
      } catch (errAudit) {
        console.warn('No se pudo guardar en auditoría:', errAudit);
      }

      cerrarModal();
      await cargarUsuarios();
    } catch (err) {
      console.error('Error al editar usuario:', err);
      setErrorForm('No se pudo guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function enviarCorreoRestablecimientoPassword() {
    const correoDestino = (form.correo || usuarioEditando?.Correo || '').trim().toLowerCase();
    if (!correoDestino) {
      setErrorForm('El usuario no tiene un correo electrónico válido para restablecer la contraseña.');
      return;
    }

    setEnviandoReset(true);
    setErrorForm('');
    setMensajeExitoModal('');

    try {
      await sendPasswordResetEmail(auth, correoDestino);
      setMensajeExitoModal(
        `Se envió un correo de restablecimiento de contraseña a ${correoDestino}.`
      );
    } catch (err) {
      console.error('Error enviando correo de restablecimiento:', err);
      setErrorForm(
        'No se pudo enviar el correo de restablecimiento: ' + (err.message || 'Intenta nuevamente.')
      );
    } finally {
      setEnviandoReset(false);
    }
  }

  async function alternarEstado(u) {
    const nuevoEstado = Number(u.ID_EstadoUsuario ?? 1) === 1 ? 2 : 1;
    const accion = nuevoEstado === 2 ? 'desactivar' : 'activar';
    const nombre = `${u.Nombres ?? ''} ${u.Apellidos ?? ''}`.trim() || `#${u.ID_User}`;

    if (!confirm(`¿Seguro que deseas ${accion} a ${nombre}?`)) return;

    try {
      if (nuevoEstado === 2) {
        const estRef = doc(db, 'Estado_User', '2');
        const snapEst = await getDoc(estRef);
        if (!snapEst.exists()) {
          await setDoc(estRef, { ID_EstadoUsuario: 2, Estado: 'Baneado' });
        }
      }

      const estadoAnterior = Number(u.ID_EstadoUsuario ?? 1);
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch('/api/admin/usuarios', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ idUser: u.ID_User, nuevoEstado }),
      });

      if (!res.ok) {
        await actualizarDocumentoUser(u, { ID_EstadoUsuario: nuevoEstado });
        try {
          const idUserAccion = (await obtenerIdUsuario()) || auth.currentUser?.uid || 'Admin';
          const auditEstadoRef = doc(collection(db, 'Auditoria_CambioEstado_User'));
          await setDoc(auditEstadoRef, {
            ID_Auditoria: auditEstadoRef.id,
            ID_User: u.ID_User,
            ID_UserAccion: idUserAccion,
            ID_EstadoAnterior: estadoAnterior,
            ID_EstadoNuevo: nuevoEstado,
            Fecha_Registro: new Date().toISOString(),
          });
        } catch (errAuditEst) {
          console.error('Error guardando Auditoria_CambioEstado_User:', errAuditEst);
        }
      }

      await cargarUsuarios();
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
            <h1>Gestión de Usuarios</h1>
            <button className="btn-agregar" onClick={abrirAgregar}>
              + Agregar usuario
            </button>
          </div>

          {/* Sistema de Pestañas (Tabs): Todos los Usuarios / Clientes vs Empleados */}
          <div className="usuarios-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={pestanaActiva === 'todos'}
              className={`usuarios-tab-btn ${pestanaActiva === 'todos' ? 'activa' : ''}`}
              onClick={() => setPestanaActiva('todos')}
            >
              <span>Todos los Usuarios / Clientes</span>
              <span className="usuarios-tab-count">{usuarios.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={pestanaActiva === 'empleados'}
              className={`usuarios-tab-btn ${pestanaActiva === 'empleados' ? 'activa' : ''}`}
              onClick={() => setPestanaActiva('empleados')}
            >
              <span>Empleados</span>
              <span className="usuarios-tab-count">{listaEmpleados.length}</span>
            </button>
          </div>

          <input
            className="buscador"
            placeholder={
              pestanaActiva === 'empleados'
                ? 'Buscar empleado por nombre, correo, DUI o teléfono...'
                : 'Buscar usuario por nombre, correo, DUI o teléfono...'
            }
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {cargando ? (
            <p>Cargando registros de usuarios...</p>
          ) : (
            <div className="tabla-wrapper">
              <table className="tabla-productos">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre / Usuario</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th>DUI</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosMostrados.map((u) => {
                    const activo = Number(u.ID_EstadoUsuario ?? 1) === 1;
                    const idRolNum = resolverIdRolUsuario(u);
                    const claseBadgeRol =
                      idRolNum === 1 ? 'admin' : idRolNum === 2 ? 'empleado' : 'cliente';
                    const nombreRol =
                      idRolNum === 1
                        ? 'Administrador'
                        : idRolNum === 2
                        ? 'Empleado'
                        : 'Cliente';

                    return (
                      <tr key={u._docId || u.ID_User} style={{ opacity: activo ? 1 : 0.6 }}>
                        <td>{u.ID_User}</td>
                        <td>
                          <div className="usuarios-nombre-principal">
                            {`${u.Nombres ?? ''} ${u.Apellidos ?? ''}`.trim() || 'Sin nombre'}
                          </div>
                          {u.Usuario && (
                            <div className="usuarios-subtexto">@{u.Usuario}</div>
                          )}
                        </td>
                        <td className="empleados-correo">{u.Correo || '—'}</td>
                        <td className="empleados-secundario">{u.Telefono || '—'}</td>
                        <td className="empleados-secundario">{u.DUI || '—'}</td>
                        <td>
                          <span className={`rol-badge ${claseBadgeRol}`}>{nombreRol}</span>
                        </td>
                        <td className={activo ? 'empleados-activo' : 'empleados-inactivo'}>
                          {activo ? 'Activo' : 'Inactivo'}
                        </td>
                        <td>
                          <div className="empleados-acciones">
                            <button
                              type="button"
                              className="btn-accion-editar"
                              title="Editar Usuario"
                              onClick={() => abrirEditar(u)}
                            >
                              <span>✏️</span>
                              <span>Editar Usuario</span>
                            </button>
                            <button
                              type="button"
                              className="btn-accion-estado"
                              title={activo ? 'Desactivar usuario' : 'Reactivar usuario'}
                              onClick={() => alternarEstado(u)}
                            >
                              {activo ? '🚫' : '↻'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {usuariosMostrados.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: '#777', padding: '24px' }}>
                        {pestanaActiva === 'empleados'
                          ? 'No se encontraron empleados que coincidan con la búsqueda.'
                          : 'No se encontraron usuarios para mostrar.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {(modalAbierto === 'agregar' || modalAbierto === 'editar') && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-box empleados-modal" onClick={(e) => e.stopPropagation()}>
            <div className="empleados-modal-header">
              <div>
                <h2>
                  {modalAbierto === 'editar'
                    ? `Editar Usuario #${usuarioEditando?.ID_User}`
                    : 'Nuevo Usuario'}
                </h2>
                {modalAbierto === 'editar' && (
                  <p className="empleados-incorporacion">
                    Registro: {formatearFecha(usuarioEditando?.Fecha_Creacion || usuarioEditando?.Fecha_Incorporacion)}
                  </p>
                )}
              </div>

              {modalAbierto === 'editar' && (
                <span
                  className={`empleados-badge ${
                    Number(usuarioEditando?.ID_EstadoUsuario ?? 1) === 1 ? 'activo' : 'inactivo'
                  }`}
                >
                  {Number(usuarioEditando?.ID_EstadoUsuario ?? 1) === 1 ? 'ACTIVO' : 'INACTIVO'}
                </span>
              )}

              <button
                type="button"
                className="btn-cerrar-modal"
                onClick={cerrarModal}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="empleados-modal-body">
              <div className="empleados-modal-campos">
                <div className="campos-fila-doble">
                  <div className="campo-grupo">
                    <label>Nombres *</label>
                    <input
                      value={form.nombres}
                      placeholder="Ej. María José"
                      onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
                    />
                  </div>

                  <div className="campo-grupo">
                    <label>Apellidos</label>
                    <input
                      value={form.apellidos}
                      placeholder="Ej. Hernández"
                      onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="campos-fila-doble">
                  <div className="campo-grupo">
                    <label>Usuario (Username)</label>
                    <input
                      value={form.usuario}
                      placeholder="usuario_ejemplo"
                      onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))}
                    />
                  </div>

                  <div className="campo-grupo">
                    <label>Correo Electrónico *</label>
                    <input
                      type="email"
                      value={form.correo}
                      placeholder="correo@ejemplo.com"
                      onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="campos-fila-doble">
                  <div className="campo-grupo">
                    <label>Teléfono (8 dígitos)</label>
                    <input
                      type="tel"
                      value={form.telefono}
                      placeholder="70000000"
                      maxLength={8}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, telefono: formatearTelefono(e.target.value) }))
                      }
                    />
                  </div>

                  <div className="campo-grupo">
                    <label>DUI {modalAbierto === 'agregar' ? '*' : ''}</label>
                    <input
                      value={form.dui}
                      placeholder="12345678-9"
                      maxLength={10}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, dui: formatearDui(e.target.value) }))
                      }
                    />
                  </div>
                </div>

                <label>Rol del Usuario (ID_Rol)</label>
                <select
                  value={form.idRol}
                  onChange={(e) => setForm((f) => ({ ...f, idRol: Number(e.target.value) }))}
                >
                  {ROLES_CATALOGO.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} — {r.label}
                    </option>
                  ))}
                </select>

                {/* Sección de Cambio y Restablecimiento de Contraseña */}
                <div className="seccion-password-modal">
                  <p className="seccion-password-titulo">Seguridad y Contraseña</p>

                  <label style={{ marginTop: 0 }}>
                    {modalAbierto === 'editar'
                      ? 'Asignar nueva contraseña (opcional)'
                      : 'Contraseña inicial (opcional)'}
                  </label>
                  <div className="password-input-row">
                    <input
                      type={mostrarPassword ? 'text' : 'password'}
                      value={form.nuevaPassword}
                      placeholder={
                        modalAbierto === 'editar'
                          ? 'Dejar vacío para conservar la actual'
                          : 'Mínimo 6 caracteres (o vacío para enlace por correo)'
                      }
                      onChange={(e) => setForm((f) => ({ ...f, nuevaPassword: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn-toggle-pwd"
                      onClick={() => setMostrarPassword((v) => !v)}
                    >
                      {mostrarPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>

                  {modalAbierto === 'editar' && (
                    <button
                      type="button"
                      className="btn-reset-email"
                      onClick={enviarCorreoRestablecimientoPassword}
                      disabled={enviandoReset || guardando}
                    >
                      {enviandoReset
                        ? 'Enviando correo de restablecimiento...'
                        : '✉️ Enviar correo de restablecimiento de contraseña'}
                    </button>
                  )}
                </div>
              </div>

              <div className="empleados-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
                </svg>
              </div>
            </div>

            {errorForm && <p className="empleados-error">{errorForm}</p>}
            {mensajeExitoModal && <p className="empleados-exito">{mensajeExitoModal}</p>}

            <button
              type="button"
              className="btn-guardar"
              onClick={modalAbierto === 'editar' ? guardarEdicion : guardarNuevo}
              disabled={guardando}
            >
              {guardando
                ? 'Guardando...'
                : modalAbierto === 'editar'
                ? 'Guardar cambios'
                : 'Crear usuario'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
