import { session } from './api';

export function saveSessionUser(user) {
  const current = session();
  if (!current) return;
  localStorage.setItem('empimecatronic_session', JSON.stringify({ ...current, user }));
  window.dispatchEvent(new Event('empimecatronic:profile-updated'));
}

export function imageForUpload(file, maxSide = 512) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file?.type)) throw new Error('Selecione uma imagem PNG, JPG ou WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem precisa ter até 5 MB.');
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const result = canvas.toDataURL('image/webp', 0.82);
      if (result.length > 180000) reject(new Error('Imagem muito grande após otimização. Escolha uma menor.'));
      else resolve(result);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir a imagem.')); };
    image.src = url;
  });
}
