'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { usePathname } from 'next/navigation';

const workspaceKey = 'bwp.workspace';
const logoutEvent = 'bwp:logout';

function isWorkspace(path: string) {
  return /^\/(panel|clientes)(\/|$)/.test(path);
}

function revokeSession() {
  return fetch('/api/auth/session', {
    method: 'DELETE', cache: 'no-store', credentials: 'same-origin', keepalive: true,
  });
}

export function closeWorkspace() {
  window.dispatchEvent(new Event(logoutEvent));
}

export default function WorkspaceSessionGuard({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [checkedPath, setCheckedPath] = useState('');
  const [status, setStatus] = useState<'ready' | 'hidden' | 'closing' | 'retry'>('ready');
  const closing = useRef(false);
  const inFlight = useRef(false);

  useLayoutEffect(() => {
    async function logout() {
      if (inFlight.current) return;
      inFlight.current = true;
      closing.current = true;
      sessionStorage.setItem(workspaceKey, 'closing');
      setStatus('closing');
      try {
        const response = await revokeSession();
        if (!response.ok) throw new Error();
        sessionStorage.removeItem(workspaceKey);
        window.location.replace('/login');
      } catch {
        inFlight.current = false;
        setStatus('retry');
      }
    }

    function handleTraversal() {
      if (isWorkspace(location.pathname) || sessionStorage.getItem(workspaceKey)) {
        void logout();
      }
    }

    function hideWorkspace() {
      if (!isWorkspace(location.pathname)) return;
      // Remove private content before a browser takes a back/forward-cache snapshot.
      flushSync(() => setStatus('hidden'));
      const browserNavigation = (window as Window & { navigation?: { canGoBack: boolean } }).navigation;
      const hasAppPredecessor = browserNavigation?.canGoBack ||
        (!browserNavigation && document.referrer.startsWith(location.origin + '/'));
      if (history.length > 1 && !hasAppPredecessor && !closing.current) {
        // An external history destination cannot run our guard. Revoke during departure
        // and leave a retry marker in case the browser disconnects before delivery.
        sessionStorage.setItem(workspaceKey, 'closing');
        void revokeSession().catch(() => {});
      }
    }

    function restore(event: PageTransitionEvent) {
      if (event.persisted) handleTraversal();
    }

    window.addEventListener(logoutEvent, logout);
    window.addEventListener('popstate', handleTraversal, true);
    window.addEventListener('pagehide', hideWorkspace);
    window.addEventListener('pageshow', restore);

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (sessionStorage.getItem(workspaceKey) === 'closing') void logout();
    else if (navigation?.type === 'back_forward') handleTraversal();

    return () => {
      window.removeEventListener(logoutEvent, logout);
      window.removeEventListener('popstate', handleTraversal, true);
      window.removeEventListener('pagehide', hideWorkspace);
      window.removeEventListener('pageshow', restore);
    };
  }, []);

  useLayoutEffect(() => {
    if (closing.current) return;
    if (isWorkspace(path)) sessionStorage.setItem(workspaceKey, 'active');
    else sessionStorage.removeItem(workspaceKey);
    setCheckedPath(path);
  }, [path]);

  if (status === 'retry') {
    return <main className="p-12 text-center" role="alert">
      <p>Tu panel está bloqueado. Comprueba la conexión para completar el cierre de sesión.</p>
      <button className="mt-4 rounded-lg bg-[#7A1C24] px-5 py-2 text-white" onClick={closeWorkspace}>Reintentar cierre de sesión</button>
    </main>;
  }
  if (status !== 'ready' || (isWorkspace(path) && checkedPath !== path)) {
    return <main className="p-12 text-center" role="status">{status === 'closing' ? 'Cerrando sesión…' : 'Comprobando acceso…'}</main>;
  }
  return children;
}
