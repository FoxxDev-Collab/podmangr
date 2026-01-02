const API_BASE = '/api';

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Health check
  health: () => apiFetch<{ status: string }>('/health'),

  // Auth
  auth: {
    login: (username: string, password: string) =>
      apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  },

  // System
  system: {
    info: () => apiFetch('/system/info'),
    resources: () => apiFetch('/system/resources'),
  },

  // Processes
  processes: {
    list: () => apiFetch('/processes'),
    kill: (pid: number) =>
      apiFetch(`/processes/${pid}`, { method: 'DELETE' }),
  },

  // Services
  services: {
    list: () => apiFetch('/services'),
    get: (name: string) => apiFetch(`/services/${name}`),
    action: (name: string, action: 'start' | 'stop' | 'restart' | 'enable' | 'disable') =>
      apiFetch(`/services/${name}/${action}`, { method: 'POST' }),
  },

  // Updates
  updates: {
    available: () => apiFetch('/updates/available'),
    apply: (packages?: string[]) =>
      apiFetch('/updates/apply', {
        method: 'POST',
        body: JSON.stringify({ packages }),
      }),
    history: () => apiFetch('/updates/history'),
  },

  // Storage
  storage: {
    disks: () => apiFetch('/storage/disks'),
    mounts: () => apiFetch('/storage/mounts'),
    lvm: () => apiFetch('/storage/lvm'),
  },

  // Users
  users: {
    list: () => apiFetch('/users'),
    get: (id: number) => apiFetch(`/users/${id}`),
    create: (data: { username: string; password: string; display_name?: string; role?: string }) =>
      apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: { display_name?: string; role?: string; disabled?: boolean }) =>
      apiFetch(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      apiFetch(`/users/${id}`, { method: 'DELETE' }),
  },

  // Pods
  pods: {
    list: () => apiFetch('/pods'),
    create: (data: { name: string; port_mappings?: string[]; labels?: Record<string, string> }) =>
      apiFetch('/pods', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    inspect: (id: string) => apiFetch(`/pods/${id}/inspect`),
    start: (id: string) => apiFetch(`/pods/${id}/start`, { method: 'POST' }),
    stop: (id: string) => apiFetch(`/pods/${id}/stop`, { method: 'POST' }),
    restart: (id: string) => apiFetch(`/pods/${id}/restart`, { method: 'POST' }),
    pause: (id: string) => apiFetch(`/pods/${id}/pause`, { method: 'POST' }),
    unpause: (id: string) => apiFetch(`/pods/${id}/unpause`, { method: 'POST' }),
    remove: (id: string, force = false) =>
      apiFetch(`/pods/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' }),
  },

  // Containers
  containers: {
    list: () => apiFetch('/containers'),
    get: (id: string) => apiFetch(`/containers/${id}`),
    inspect: (id: string) => apiFetch(`/containers/${id}/inspect`),
    start: (id: string) => apiFetch(`/containers/${id}/start`, { method: 'POST' }),
    stop: (id: string) => apiFetch(`/containers/${id}/stop`, { method: 'POST' }),
    restart: (id: string) => apiFetch(`/containers/${id}/restart`, { method: 'POST' }),
    remove: (id: string) => apiFetch(`/containers/${id}`, { method: 'DELETE' }),
    logs: (id: string) => apiFetch(`/containers/${id}/logs`),
    stats: (id: string) => apiFetch(`/containers/${id}/stats`),
  },

  // Images
  images: {
    list: () => apiFetch('/images'),
    pull: (image: string) => apiFetch('/images/pull', {
      method: 'POST',
      body: JSON.stringify({ image }),
    }),
    remove: (id: string) => apiFetch(`/images/${id}`, { method: 'DELETE' }),
    prune: () => apiFetch('/images/prune', { method: 'POST' }),
  },

  // Volumes
  volumes: {
    list: () => apiFetch('/volumes'),
    create: (name: string, driver?: string) => apiFetch('/volumes', {
      method: 'POST',
      body: JSON.stringify({ name, driver }),
    }),
    inspect: (name: string) => apiFetch(`/volumes/${name}`),
    remove: (name: string) => apiFetch(`/volumes/${name}`, { method: 'DELETE' }),
    prune: () => apiFetch('/volumes/prune', { method: 'POST' }),
  },

  // Networks
  networks: {
    list: () => apiFetch('/networks'),
    create: (data: { name: string; driver?: string; subnet?: string; gateway?: string; internal?: boolean; ipv6?: boolean }) =>
      apiFetch('/networks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    inspect: (id: string) => apiFetch(`/networks/${id}`),
    remove: (id: string) => apiFetch(`/networks/${id}`, { method: 'DELETE' }),
  },

  // Podman Sockets/Contexts
  sockets: {
    list: () => apiFetch('/podman-sockets'),
    switch: (socketId: string) => apiFetch('/podman-sockets/switch', {
      method: 'POST',
      body: JSON.stringify({ socket_id: socketId }),
    }),
    refresh: () => apiFetch('/podman-sockets/refresh', { method: 'POST' }),
  },

  // Translation Engine
  translate: {
    translate: (input: string, format: string) => apiFetch('/translate', {
      method: 'POST',
      body: JSON.stringify({ input, format }),
    }),
    validate: (input: string) => apiFetch('/translate/validate', {
      method: 'POST',
      body: JSON.stringify({ input }),
    }),
    rules: () => apiFetch('/translate/rules'),
  },
};
