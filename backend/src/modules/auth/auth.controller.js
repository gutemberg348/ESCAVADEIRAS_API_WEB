import { authService } from './auth.service.js';
export const authController = {
  login: async (req, res) => res.json(await authService.login(req.body)),
  refresh: async (req, res) => res.json(await authService.refresh(req.body.refreshToken)),
  logout: async (req, res) => { await authService.logout(req.body?.refreshToken); res.status(204).send(); },
  me: async (req, res) => res.json(await authService.me(req.user.sub)),
  updateMe: async (req, res) => res.json(await authService.updateMe(req.user.sub, req.body)),
  changePassword: async (req, res) => { await authService.changePassword(req.user.sub, req.body); res.status(204).send(); }
};
