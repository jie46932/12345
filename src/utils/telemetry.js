import { createClient } from '@supabase/supabase-js';

const TELEMETRY_TABLE = 'viewer_events';
const PROJECT_ID = '12345';
const QUEUE_KEY = 'he_furniture_telemetry_queue';
const SESSION_KEY = 'he_furniture_telemetry_session_id';
const MAX_QUEUE_SIZE = 100;
const MAX_STRING_LENGTH = 1000;
const SENSITIVE_KEY_PATTERN = /password|pass|token|secret|authorization|phone|mobile|tel|wechat|weixin|name|姓名|电话|手机|微信/i;

let supabaseClient = null;
let flushing = false;
let listenersInstalled = false;

function telemetryEnabled() {
  return import.meta.env.VITE_TELEMETRY_ENABLED === '1';
}

function getSupabaseClient() {
  if (!telemetryEnabled()) return null;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getTelemetrySessionId() {
  if (typeof window === 'undefined') return createSessionId();
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = createSessionId();
    sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return createSessionId();
  }
}

function getRouteParams() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const output = {};
  for (const [key, value] of params.entries()) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    output[key] = safeString(value);
  }
  return output;
}

function getPageUrl() {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}`;
}

function getWebglRenderer() {
  if (typeof window === 'undefined') return null;
  const rendererInfo = window.__threeRenderer?.info;
  const gl = window.__threeRenderer?.getContext?.();
  const debugInfo = gl?.getExtension?.('WEBGL_debug_renderer_info');
  if (!gl || !debugInfo) return rendererInfo ? 'three_renderer_ready' : null;
  return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
}

function getDeviceInfo() {
  if (typeof window === 'undefined') return {};
  return {
    userAgent: safeString(navigator.userAgent),
    platform: safeString(navigator.platform),
    language: safeString(navigator.language),
    screen: {
      width: window.screen?.width || null,
      height: window.screen?.height || null,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    devicePixelRatio: window.devicePixelRatio || 1,
    rendererMode: document.documentElement.dataset.viewerRenderer || 'webgl',
    webglRenderer: safeString(getWebglRenderer()),
  };
}

function safeString(value) {
  if (value == null) return value;
  const text = String(value);
  return text.length > MAX_STRING_LENGTH ? `${text.slice(0, MAX_STRING_LENGTH)}...` : text;
}

function sanitizeValue(value, depth = 0) {
  if (depth > 4) return '[max_depth]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return safeString(value);
  if (value instanceof Error) {
    return {
      name: safeString(value.name),
      message: safeString(value.message),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = '[redacted]';
      } else {
        output[key] = sanitizeValue(item, depth + 1);
      }
    }
    return output;
  }
  return safeString(value);
}

function normalizeError(error) {
  if (!error) return {};
  if (error instanceof Error) {
    return {
      name: safeString(error.name),
      message: safeString(error.message),
      stack: safeString(error.stack),
    };
  }
  return {
    message: safeString(error),
  };
}

function buildEvent(eventType, eventName, severity, payload = {}) {
  return {
    project_id: PROJECT_ID,
    session_id: getTelemetrySessionId(),
    event_type: eventType,
    event_name: eventName,
    severity,
    page_url: getPageUrl(),
    route_params: getRouteParams(),
    device: getDeviceInfo(),
    payload: sanitizeValue(payload),
  };
}

function readQueue() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeQueue(items) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE_SIZE)));
  } catch {
    // Storage can be unavailable or full; telemetry must never break the viewer.
  }
}

function enqueueEvent(event) {
  writeQueue([...readQueue(), event]);
}

async function insertEvent(event, queueOnFailure = true) {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from(TELEMETRY_TABLE).insert(event);
    if (error) throw error;
    return true;
  } catch (error) {
    if (queueOnFailure) enqueueEvent(event);
    if (import.meta.env.DEV) {
      console.warn('[telemetry] insert failed', error?.message || error);
    }
    return false;
  }
}

export async function flushTelemetryQueue() {
  if (flushing || !getSupabaseClient()) return;
  flushing = true;
  const queue = readQueue();
  const remaining = [];
  for (const event of queue) {
    const ok = await insertEvent(event, false);
    if (!ok) remaining.push(event);
  }
  writeQueue(remaining);
  flushing = false;
}

export function trackOperation(eventName, payload = {}) {
  const event = buildEvent('operation', eventName, 'info', payload);
  void insertEvent(event);
}

export function trackError(eventName, error, payload = {}) {
  const event = buildEvent('error', eventName, 'error', {
    ...payload,
    error: normalizeError(error),
  });
  void insertEvent(event);
}

export function trackModelError(eventName, error, payload = {}) {
  const event = buildEvent('model_error', eventName, 'error', {
    ...payload,
    error: normalizeError(error),
  });
  void insertEvent(event);
}

export function trackResourceError(payload = {}) {
  const event = buildEvent('resource_error', 'resource_load_failed', 'warn', payload);
  void insertEvent(event);
}

export function trackPerformance(eventName, payload = {}) {
  const event = buildEvent('performance', eventName, 'info', payload);
  void insertEvent(event);
}

export function installTelemetryListeners() {
  if (typeof window === 'undefined' || listenersInstalled) return;
  listenersInstalled = true;

  window.addEventListener('error', (event) => {
    const target = event.target;
    if (target && target !== window) {
      trackResourceError({
        tagName: target.tagName,
        resourceUrl: target.currentSrc || target.src || target.href || '',
      });
      return;
    }
    trackError('runtime_error_reported', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    trackError('promise_rejection_reported', event.reason);
  });

  window.addEventListener('online', () => {
    void flushTelemetryQueue();
  });

  if (import.meta.env.DEV) {
    window.__telemetry = {
      trackOperation,
      trackError,
      trackResourceError,
      trackPerformance,
      flushTelemetryQueue,
      getSessionId: getTelemetrySessionId,
      getQueue: readQueue,
    };
  }

  void flushTelemetryQueue();
}
