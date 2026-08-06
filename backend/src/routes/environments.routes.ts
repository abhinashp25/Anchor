import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

export const environmentsRouter = Router();
environmentsRouter.use(requireAuth);

environmentsRouter.get("/", async (req, res) => {
  const environments = await db.environment.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "asc" },
  });
  res.json({ environments });
});

const createSchema = z.object({ name: z.string().min(1).max(120) });

environmentsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Name is required" });

  const environment = await db.environment.create({
    data: { userId: req.userId!, name: parsed.data.name, variables: [] },
  });
  res.status(201).json({ environment });
});

// 500 KB limit on the variables field — prevents any single environment from growing
// unboundedly in MongoDB by sending oversized payloads through the API.
const VARIABLES_MAX_BYTES = 500_000;

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  variables: z
    .any()
    .optional()
    .superRefine((val, ctx) => {
      if (val === undefined) return;
      const bytes = Buffer.byteLength(JSON.stringify(val), "utf8");
      if (bytes > VARIABLES_MAX_BYTES) {
        ctx.addIssue({
          code: "custom",
          message: "variables exceeds the 500 KB limit",
        });
      }
    }),
});

environmentsRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    // Return 413 specifically for the size limit error, 400 for everything else.
    const message = parsed.error.issues[0]?.message ?? "Invalid update payload";
    const status = message.includes("500 KB") ? 413 : 400;
    return res.status(status).json({ error: message });
  }

  const existing = await db.environment.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) return res.status(404).json({ error: "Environment not found" });

  const environment = await db.environment.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json({ environment });
});

// Marks one environment active and unsets all others for this user (Mongo has no
// cross-document transaction guarantee here without a real transaction, so we use one).
environmentsRouter.post("/:id/activate", async (req, res) => {
  const existing = await db.environment.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) return res.status(404).json({ error: "Environment not found" });

  await db.$transaction([
    db.environment.updateMany({ where: { userId: req.userId! }, data: { isActive: false } }),
    db.environment.update({ where: { id: req.params.id }, data: { isActive: true } }),
  ]);
  res.json({ ok: true });
});

environmentsRouter.delete("/:id", async (req, res) => {
  const existing = await db.environment.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) return res.status(404).json({ error: "Environment not found" });

  await db.environment.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
