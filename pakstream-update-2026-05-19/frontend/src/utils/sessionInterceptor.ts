// Global fetch interceptor that detects when the backend has invalidated the
// current session (a fresh login on another device rotated the user's
// sessionToken). When that happens the API returns 401 with
// code === 'SESSION_INVALIDATED'; we dispatch a `force-logout` window event so
// the auth layer can tear down local state and surface a notice to the user.

let installed = false;

export const installSessionInterceptor = (): void => {
  if (installed || typeof window === 'undefined' || !window.fetch) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);

    if (response.status === 401) {
      try {
        const peek = response.clone();
        const data = await peek.json();
        if (data && data.code === 'SESSION_INVALIDATED') {
          window.dispatchEvent(
            new CustomEvent('force-logout', {
              detail: {
                reason: 'session-invalidated',
                message:
                  data.message ||
                  'Your account has been signed in on another device or browser. For your security, this session has been ended.'
              }
            })
          );
        }
      } catch {
        // Body wasn't JSON or already consumed elsewhere — ignore.
      }
    }

    return response;
  };
};
