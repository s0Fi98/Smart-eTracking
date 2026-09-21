import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

// Create operator
router.post("/", async (req, res) => {
  const { name, contactPerson, contact, email, address } = req.body;

  if (!name || !contact) {
    return res.status(400).json({ message: "name and contact are required" });
  }

  const operator = await prisma.parkingOperator.create({
    data: { name, contactPerson, contact, email, address },
  });
  res.status(201).json(operator);
});

// List operators
router.get("/", async (req, res) => {
  const operators = await prisma.parkingOperator.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(operators);
});

export default router;