import { auth, db } from './firebaseClient';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

/**
 * Traduce el usuario logueado en Firebase Auth al ID_User de la colección "User" propia,
 * que es la que usan las referencias del resto del esquema (Favoritos, Pedido, Direcciones...).
 */
export async function obtenerIdUsuario() {
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }

    const user = auth.currentUser;
    if (!user) return null;

    // 1. Intentar buscar por Document ID directo igual a user.uid
    const docRef = doc(db, 'User', user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.ID_User ?? docSnap.id;
    }

    // 2. Buscar por el campo auth_id en la colección User
    const qAuth = query(collection(db, 'User'), where('auth_id', '==', user.uid));
    const snapAuth = await getDocs(qAuth);
    if (!snapAuth.empty) {
      const data = snapAuth.docs[0].data();
      return data.ID_User ?? snapAuth.docs[0].id;
    }

    // 3. Fallback de búsqueda por Correo electrónico si existe
    if (user.email) {
      const qEmail = query(collection(db, 'User'), where('Correo', '==', user.email));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const data = snapEmail.docs[0].data();
        return data.ID_User ?? snapEmail.docs[0].id;
      }
    }

    return null;
  } catch (error) {
    console.error('Error al obtener ID de usuario desde Firestore:', error);
    return null;
  }
}

/**
 * Obtiene el perfil completo del usuario autenticado en Firestore
 */
export async function obtenerPerfilUsuario() {
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }

    const user = auth.currentUser;
    if (!user) return null;

    // 1. Buscar documento directo
    const docRef = doc(db, 'User', user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data(), email: user.email };
    }

    // 2. Buscar por auth_id
    const qAuth = query(collection(db, 'User'), where('auth_id', '==', user.uid));
    const snapAuth = await getDocs(qAuth);
    if (!snapAuth.empty) {
      const d = snapAuth.docs[0];
      return { id: d.id, ...d.data(), email: user.email };
    }

    // 3. Buscar por Correo
    if (user.email) {
      const qEmail = query(collection(db, 'User'), where('Correo', '==', user.email));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const d = snapEmail.docs[0];
        return { id: d.id, ...d.data(), email: user.email };
      }
    }

    return null;
  } catch (error) {
    console.error('Error al obtener perfil del usuario desde Firestore:', error);
    return null;
  }
}
