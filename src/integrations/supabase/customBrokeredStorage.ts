import { brokeredPreviewStorage as originalBrokeredStorage } from './previewAuthStorage';

/**
 * Custom wrapper for brokered preview storage that allows using a project ID from environment variables
 * when it cannot be extracted from the hostname.
 */
export function customBrokeredPreviewStorage() {
  if (typeof window === 'undefined') return undefined;

  const storage = originalBrokeredStorage();
  
  // If the original already returned something other than localStorage, 
  // it means it successfully identified the project from hostname.
  if (storage !== localStorage) return storage;

  const host = location.hostname;
  const framed = window.parent && window.parent !== window;
  const envProjectId = import.meta.env.VITE_LOVABLE_PROJECT_ID;

  // Security check: Must be framed and have a project ID
  if (!envProjectId || !framed) return localStorage;

  // Origin validation (mirrored from original for safety)
  const dev = host.endsWith('.lovableproject-dev.com') || host.endsWith('.gpt-eng.com');
  const EDITOR = dev
    ? /^https:\/\/([a-z0-9-]+\.)*(lovable\.dev|gptengineer\.app)$|^http:\/\/localhost:3000$/
    : /^https:\/\/([a-z0-9-]+\.)*(lovable\.dev|gptengineer\.app)$/;

  const ancestor = (location.ancestorOrigins && location.ancestorOrigins[0]) || (document.referrer ? new URL(document.referrer).origin : '');
  
  if (!ancestor || !EDITOR.test(ancestor)) {
    return localStorage;
  }

  const editorOrigins = [ancestor];
  const RESULT = 'lovable-preview-auth:result';
  const TIMEOUT = 5000; // Increased to 5s per requirement
  const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  const request = (type: string, key: string, value?: string): Promise<{ ok: boolean; value?: string | null } | null> =>
    new Promise((resolve) => {
      const requestId = newId();
      let done = false;
      let timer: ReturnType<typeof setTimeout>;
      
      const finish = (r: { ok: boolean; value?: string | null } | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        if (r === null) {
          console.warn(`[BrokeredStorage] Request ${type} timed out after ${TIMEOUT}ms for key ${key}`);
        }
        resolve(r);
      };

      const onMessage = (e: MessageEvent) => {
        if (editorOrigins.indexOf(e.origin) < 0) return;
        const d = e.data;
        if (d && d.type === RESULT && d.requestId === requestId) finish(d);
      };

      window.addEventListener('message', onMessage);
      const msg: Record<string, unknown> = { type, requestId, projectId: envProjectId, key };
      if (value !== undefined) msg['value'] = value;
      
      for (const origin of editorOrigins) window.parent.postMessage(msg, origin);
      timer = setTimeout(() => finish(null), TIMEOUT);
    });

  let firstGet = true;
  const RETRY_DELAY = 250;

  return {
    getItem: async (key: string) => {
      let res = await request('lovable-preview-auth:get', key);
      if (!res && firstGet) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
        res = await request('lovable-preview-auth:get', key);
      }
      firstGet = false;
      if (res && res.ok && typeof res.value === 'string') {
        if (res.value === '') { localStorage.removeItem(key); return null; }
        return res.value;
      }
      return localStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
      localStorage.setItem(key, value);
      return request('lovable-preview-auth:set', key, value).then(() => undefined);
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key);
      return request('lovable-preview-auth:remove', key).then(() => undefined);
    },
  };
}
