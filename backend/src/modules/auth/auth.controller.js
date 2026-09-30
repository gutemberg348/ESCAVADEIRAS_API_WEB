import { authService } from './auth.service.js';
export const authController = {
  login: async (req, res) => res.json(await authService.login(req.body)),
  refresh: async (req, res) => res.json(await authService.refresh(req.body.refreshToken)),
  logout: async (req, res) => { await authService.logout(req.body?.refreshToken); res.status(204).send(); },
  me: async (req, res) => res.json(await authService.me(req.user.sub))
};
