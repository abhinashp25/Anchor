import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

export const collectionsRouter = Router();
collectionsRouter.use(requireAuth);

collectionsRouter.get("/", async (req, res) => {
  const collections = await db.collection.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "asc" },
  });
  res.json({ collections });
});

const createSchema = z.object({ name: z.string().min(1).max(120) });

collectionsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Name is required" });

  const collection = await db.collection.create({
    data: { userId: req.userId!, name: parsed.data.name, nodes: [] },
  });
  res.status(201).json({ collection });
});

// 500 KB limit on the nodes field — prevents any single collection from growing
// unboundedly in MongoDB by sending oversized payloads through the API.
const NODES_MAX_BYTES = 500_000;

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  nodes: z
    .any()
    .optional()
    .superRefine((val, ctx) => {
      if (val === undefined) return;
      const bytes = Buffer.byteLength(JSON.stringify(val), "utf8");
      if (bytes > NODES_MAX_BYTES) {
        ctx.addIssue({
          code: "custom",
          message: "nodes exceeds the 500 KB limit",
        });
      }
    }),
});

collectionsRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    // Return 413 specifically for the size limit error, 400 for everything else.
    const message = parsed.error.issues[0]?.message ?? "Invalid update payload";
    const status = message.includes("500 KB") ? 413 : 400;
    return res.status(status).json({ error: message });
  }

  const existing = await db.collection.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) return res.status(404).json({ error: "Collection not found" });

  const collection = await db.collection.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json({ collection });
});

collectionsRouter.delete("/:id", async (req, res) => {
  const existing = await db.collection.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) return res.status(404).json({ error: "Collection not found" });

  await db.collection.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
