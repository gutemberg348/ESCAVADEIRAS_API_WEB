import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../infrastructure/database/prisma.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from "../../utils/errors.js";
import { rfidCodeSchema } from "./rfid.validation.js";
import { rfidService } from "./rfid.service.js";
import { captureService } from "./rfid-capture.service.js";

const createSchema = z.object({
  driverProfileId: z.string().uuid(),
  code: rfidCodeSchema,
});
const updateSchema = z.object({ active: z.boolean() });
const include = {
  driverProfile: {
    include: { user: { select: { name: true, email: true, companyId: true } } },
  },
};
const canAccess = (user, card) =>
  user.role === "SUPER_ADMIN" ||
  card.driverProfile.user.companyId === user.companyId;

export const rfidRouter = Router();
rfidRouter.use(authenticate);
rfidRouter.use(allowRoles("SUPER_ADMIN", "COMPANY_ADMIN"));
rfidRouter.post(
  "/captures",
  validate(z.object({ machineId: z.string().uuid() })),
  async (req, res) =>
    res
      .status(201)
      .json(await captureService.start(req.user, req.body.machineId)),
);
rfidRouter.get("/captures/:machineId/:id", async (req, res) =>
  res.json(
    await captureService.get(req.user, req.params.machineId, req.params.id),
  ),
);
rfidRouter.delete("/captures/:machineId/:id", async (req, res) => {
  await captureService.cancel(req.user, req.params.machineId, req.params.id);
  res.sendStatus(204);
});
rfidRouter.get("/", async (req, res) => {
  const where =
    req.user.role === "SUPER_ADMIN"
      ? {}
      : { driverProfile: { user: { companyId: req.user.companyId } } };
  res.json(
    await prisma.rfidCard.findMany({
      where,
      include,
      orderBy: { updatedAt: "desc" },
    }),
  );
});
rfidRouter.post(
  "/",
  allowRoles("SUPER_ADMIN", "COMPANY_ADMIN"),
  validate(createSchema),
  async (req, res) => {
    const profile = await prisma.driverProfile.findUnique({
      where: { id: req.body.driverProfileId },
      include: { user: true },
    });
    if (!profile || profile.deletedAt || !profile.user.active) throw new NotFoundError("Operador ativo não encontrado");
    if (
      req.user.role !== "SUPER_ADMIN" &&
      profile.user.companyId !== req.user.companyId
    )
      throw new AuthorizationError();
    const existing = await prisma.rfidCard.findUnique({
      where: { code: req.body.code },
      include,
    });
    if (existing) {
      if (!canAccess(req.user, existing))
        throw new ConflictError("Este cartão já está cadastrado no sistema.");
      if (existing.driverProfile.deletedAt) {
        const card = await prisma.$transaction(async tx => {
          const updated = await tx.rfidCard.update({ where: { id: existing.id }, data: { driverProfileId: profile.id, active: true }, include });
          await tx.auditLog.create({ data: { userId: req.user.sub, action: 'RFID_REASSIGNED', resource: 'RfidCard', resourceId: existing.id, metadata: { previousDriverProfileId: existing.driverProfileId, driverProfileId: profile.id } } });
          return updated;
        });
        return res.json(card);
      }
      if (existing.driverProfileId !== profile.id)
        throw new ConflictError(
          `Este cartão já pertence ao operador ${existing.driverProfile.user.name}.`,
        );
      const reactivated = await prisma.rfidCard.update({
        where: { id: existing.id },
        data: { active: true },
        include,
      });
      return res.json(reactivated);
    }
    const card = await prisma.rfidCard.create({ data: req.body, include });
    await prisma.auditLog.create({
      data: {
        userId: req.user.sub,
        action: "RFID_LINKED",
        resource: "RfidCard",
        resourceId: card.id,
        metadata: { driverProfileId: profile.id, code: card.code },
      },
    });
    res.status(201).json(card);
  },
);
rfidRouter.patch("/:id", validate(updateSchema), async (req, res) =>
  res.json(
    await rfidService.setCardActive(req.user, req.params.id, req.body.active),
  ),
);
rfidRouter.delete("/:id", async (req, res) =>
  res.json(await rfidService.setCardActive(req.user, req.params.id, false)),
);
