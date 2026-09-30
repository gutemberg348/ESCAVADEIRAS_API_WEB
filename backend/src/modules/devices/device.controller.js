import { deviceService } from './device.service.js';

export const deviceController = {
  list: async (req, res) => res.json(await deviceService.list(req.user)),
  create: async (req, res) => res.status(201).json(await deviceService.create(req.user, req.body)),
  rotateCredentials: async (req, res) => res.json(await deviceService.rotateCredentials(req.user, req.params.id)),
  update: async (req, res) => res.json(await deviceService.update(req.user, req.params.id, req.body)),
  revoke: async (req, res) => res.json(await deviceService.revoke(req.user, req.params.id))
};
