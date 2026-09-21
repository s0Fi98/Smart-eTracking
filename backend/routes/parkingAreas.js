import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

// Create parking area
router.post("/", async (req, res) => {
  const {
    code, name, workOrderNo, tenureStart, tenureEnd, areaSqft,
    slotValidity, latitude, longitude, totalCapacity,
    ward, address, operatorId, ticketCollectorId,
  } = req.body;

  const required = { code, name, workOrderNo, tenureStart, tenureEnd,
    areaSqft, slotValidity, latitude, longitude, totalCapacity, operatorId };
  const missing = Object.keys(required).filter((k) => required[k] === undefined);
  if (missing.length) {
    return res.status(400).json({ message: "Missing fields", missing });
  }

  const area = await prisma.parkingArea.create({
    data: {
      code, name, workOrderNo,
      tenureStart: new Date(tenureStart),
      tenureEnd: new Date(tenureEnd),
      areaSqft, slotValidity, latitude, longitude, totalCapacity,
      ward, address, operatorId, ticketCollectorId,
    },
  });
  res.status(201).json(area);
});

// List parking areas (with operator and ticket collector)
router.get("/", async (req, res) => {
  const areas = await prisma.parkingArea.findMany({
    include: {
      operator: { select: { id: true, name: true } },
      ticketCollector: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(areas);
});

// Get one area by its code, e.g. /api/parking-areas/fancy-bazar-04
router.get("/:code", async (req, res) => {
  const area = await prisma.parkingArea.findUnique({
    where: { code: req.params.code },
    include: { operator: true, ticketCollector: { select: { id: true, name: true } } },
  });
  if (!area) return res.status(404).json({ message: "Parking area not found" });
  res.json(area);
});

export default router;