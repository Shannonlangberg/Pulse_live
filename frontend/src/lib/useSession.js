import { useCallback, useEffect, useState } from 'react';

/**
 * useSession — shared session hook.
 *
 * Fetches GET /api/session exactly once per page load (module-level cache,
 * shared by every component that calls the hook) and exposes the NEW
 * backend permission contract:
 *
 *   {
 *     authenticated, role, campus,
 *     permissions,        // FULLY RESOLVED server-side booleans — gate all nav/pages on this
 *     allowed_campuses,   // array of campus ids, or null = unrestricted
 *     custom_permissions  // raw legacy overrides (Role Manager editing only)
 *   }
 *
 * Never gate UI on role names — use `permissions` keys. `role` is exposed
 * for purely cosmetic labels only.
 *
 * Dependency-free: plain fetch + a tiny module-level store with subscribers.
 */

const store = {
  loading: false,
  loaded: false,
  data: null,
  promise: null,
};

const listeners = new Set();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('[useSession] listener error:', err);
    }
  });
}

function fetchSession() {
  store.loading = true;
  notify();

  store.promise = fetch('/api/session', {
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  })
    .then((res) => res.json())
    .then((data) => {
      store.data = data && typeof data === 'object' ? data : { authenticated: false };
    })
    .catch((err) => {
      console.error('[useSession] Error fetching session:', err);
      store.data = { authenticated: false };
    })
    .then(() => {
      store.loading = false;
      store.loaded = true;
      store.promise = null;
      notify();
    });

  return store.promise;
}

export function useSession() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    if (!store.loaded && !store.promise) {
      fetchSession();
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(() => {
    if (store.promise) return store.promise;
    return fetchSession();
  }, []);

  const data = store.data || {};

  return {
    loading: !store.loaded,
    authenticated: data.authenticated === true,
    role: data.role || null,
    campus: data.campus || null,
    fullName: data.full_name || '',
    username: data.username || '',
    userId: data.id || null,
    // Fully resolved server-side permissions. {} while loading.
    permissions: data.permissions || {},
    // null = unrestricted
    allowedCampuses:
      data.allowed_campuses === undefined ? null : data.allowed_campuses,
    // Raw legacy overrides — for Role Manager editing only, never for gating.
    customPermissions: data.custom_permissions || {},
    raw: data,
    refresh,
  };
}

export default useSession;
