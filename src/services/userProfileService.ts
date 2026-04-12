import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { UserRole } from '../types/User';

export type UserProfileLoadResult =
  | { ok: true; role: UserRole; name: string | null }
  | { ok: false; reason: 'missing' | 'inactive' };

function normalizeRole(raw: string | undefined): UserRole {
  const r = (raw ?? 'cashier').toLowerCase().trim();
  if (r === 'admin') return 'admin';
  if (r === 'cajero' || r === 'cashier') return 'cashier';
  return 'cashier';
}

/**
 * Misma lógica que `loadUserData` en dmar/src/context/AuthContext.tsx:
 * documento `users/{uid}` o búsqueda por campo `uid`.
 */
export async function loadUserProfile(uid: string): Promise<UserProfileLoadResult> {
  let userDoc = await getDoc(doc(db, 'users', uid));

  if (!userDoc.exists()) {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', '==', uid));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      userDoc = querySnapshot.docs[0] as typeof userDoc;
    }
  }

  if (!userDoc.exists()) {
    return { ok: false, reason: 'missing' };
  }

  const userData = userDoc.data() as { role?: string; name?: string; isActive?: boolean };

  if (userData.isActive === false) {
    return { ok: false, reason: 'inactive' };
  }

  return {
    ok: true,
    role: normalizeRole(userData.role),
    name: typeof userData.name === 'string' ? userData.name : null,
  };
}
