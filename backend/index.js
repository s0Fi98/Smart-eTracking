import 'dotenv/config';
import prisma from './prisma.js';
import { createApp } from './app.js';

const app = createApp(prisma);
const port = Number(process.env.PORT || 5000);
const server = app.listen(port, () => console.log(`Parking API listening on port ${port}`));
async function shutdown() {
  server.close();
  await prisma.$disconnect();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
