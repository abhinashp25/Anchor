import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

export const historyRouter = Router();
historyRouter.use(requireAuth);

historyRouter.get("/", async (req, res) => {
  const history = await db.historyEntry.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ history });
});

const createSchema = z.object({
  method: z.string(),
  url: z.string(),
  status: z.number().int().optional(),
  timeMs: z.number().int().optional(),
});

historyRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid history entry" });

  const entry = await db.historyEntry.create({
    data: { userId: req.userId!, ...parsed.data },
  });
  res.status(201).json({ entry });
});

historyRouter.delete("/", async (req, res) => {
  await db.historyEntry.deleteMany({ where: { userId: req.userId! } });
  res.json({ ok: true });
});
