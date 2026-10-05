export function normalizeDeviceCode(value) {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

export function suggestedDeviceCode(machineCode) {
  return `ESP-${normalizeDeviceCode(machineCode)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
