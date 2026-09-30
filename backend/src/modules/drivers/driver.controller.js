import { driverService } from './driver.service.js';
export const driverController = {
  currentMachine: async (req, res) => res.json(await driverService.currentMachine(req.user)),
  list: async (req, res) => res.json(await driverService.list(req.user)),
  assign: async (req, res) => res.status(201).json(await driverService.assign(req.user, req.params.profileId, req.body.machineId)),
  endAssignment: async (req, res) => res.json(await driverService.endAssignment(req.user, req.params.assignmentId))
};
