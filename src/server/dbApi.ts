import { prisma } from "../infrastructure/db";

export interface SignupInput {
  id: string;
  name: string;
  email: string;
  role: string;
  customerId?: string | null;
}

export async function handleSignup(data: SignupInput) {
  const email = data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    throw new Error("A user with this email already exists in the database.");
  }

  const created = await prisma.user.create({
    data: {
      id: data.id,
      name: data.name.trim(),
      email,
      role: data.role,
      customerId: data.customerId || null,
    },
  });

  // Also log into AuditEntry table in SQLite
  try {
    await prisma.auditEntry.create({
      data: {
        id: `au-${Math.random().toString(36).slice(2, 8)}`,
        entity: "User",
        entityId: created.id,
        actor: created.name,
        action: "Registered account in database",
      },
    });
  } catch {
    // Non-critical audit log fallback
  }

  return created;
}

export async function getUsers() {
  return await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export async function updateProfile(data: { id: string; name?: string; email?: string }) {
  return await prisma.user.update({
    where: { id: data.id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.email ? { email: data.email.toLowerCase().trim() } : {}),
    },
  });
}
