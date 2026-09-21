import "dotenv/config";
import express from "express";
import cors from "cors";
import prisma from "./prisma.js";
import operatorRoutes from "./routes/operators.js";
import parkingAreaRoutes from "./routes/parkingAreas.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", async (req, res) => {
  const users = await prisma.user.count();
  res.json({ status: "ok", users });
});

app.use("/api/operators", operatorRoutes);
app.use("/api/parking-areas", parkingAreaRoutes);

// Error handler (must be after the routes)
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === "P2002") {
    return res.status(409).json({ message: "Already exists (duplicate value)" });
  }
  if (err.code === "P2003") {
    return res.status(400).json({ message: "Invalid reference, e.g. operatorId does not exist" });
  }
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));