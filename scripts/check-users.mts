import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const p = new PrismaClient();
const users = await p.user.findMany({ select: { email: true, name: true, passwordHash: true } });
console.log("users:", users.length);
for (const u of users) {
  const ok = u.passwordHash ? await bcrypt.compare("password123", u.passwordHash) : false;
  console.log(" ", u.email, "| hash:", u.passwordHash ? u.passwordHash.slice(0, 10) + "..." : "NONE", "| verify:", ok);
}
await p.$disconnect();
