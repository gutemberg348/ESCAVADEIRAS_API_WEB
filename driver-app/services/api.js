import Constants from 'expo-constants';

const metroHost = (
  Constants.expoConfig?.hostUri ||
  Constants.expoGoConfig?.debuggerHost ||
  ''
).split(':')[0];

const serverHost = metroHost || 'localhost';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || `http://${serverHost}:3000/api/v1`;

export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL || `http://${serverHost}:3000`;

export async function api(path, options = {}, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const body = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(body?.error?.message || 'Não foi possível concluir a solicitação.');
      error.status = response.status;
      throw error;
    }

    return body;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('O servidor demorou para responder. Confira o sinal da internet (Wi-Fi ou dados móveis) e tente novamente.');
    }
    if (error instanceof TypeError || /network request failed|failed to fetch|network error/i.test(error.message || '')) {
      throw new Error('Sem conexão com o servidor. Ative o Wi-Fi ou os dados móveis e tente novamente. O Bluetooth conecta à máquina, mas o login e a validação do cartão precisam de internet. Se continuar, avise o administrador para conferir o endereço da API.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const signIn = (email, password) =>
  api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const getCurrentMachine = (token) => api('/drivers/me/machine', {}, token);
export const getMachine = (machineId, token) => api(`/machines/${machineId}`, {}, token);
export const getAlerts = (token) => api('/alerts', {}, token);
export const getProfile = (token) => api('/auth/me', {}, token);
