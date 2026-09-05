import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SQLite database with DealFlow360 demo dataset...');

  // Clear existing
  await prisma.auditEntry.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.customer.deleteMany({});

  // 1. Customers
  const customers = [
    { id: "c-acme", name: "Acme Corp", tier: "Gold", industry: "Manufacturing", contactEmail: "procurement@acme.test" },
    { id: "c-delta", name: "Delta Systems", tier: "Silver", industry: "Logistics", contactEmail: "buying@delta.test" },
    { id: "c-beta", name: "Beta Industries", tier: "Bronze", industry: "Construction", contactEmail: "ops@beta.test" }
  ];

  for (const c of customers) {
    await prisma.customer.create({ data: c });
  }

  // 2. Users
  const users = [
    { id: "u-rep1", name: "Priya Raman", email: "rep@dealflow360.io", role: "SALES_REP" },
    { id: "u-rep2", name: "Marcus Feld", email: "rep2@dealflow360.io", role: "SALES_REP" },
    { id: "u-mgr", name: "Dana Whitfield", email: "manager@dealflow360.io", role: "SALES_MANAGER" },
    { id: "u-fin", name: "Owen Vasquez", email: "finance@dealflow360.io", role: "FINANCE" },
    { id: "u-admin", name: "Sasha Idris", email: "admin@dealflow360.io", role: "ADMIN" },
    { id: "u-cust-acme", name: "Lena Ortiz", email: "acme@customer.io", role: "CUSTOMER", customerId: "c-acme" },
    { id: "u-cust-beta", name: "Ravi Kapoor", email: "beta@customer.io", role: "CUSTOMER", customerId: "c-beta" }
  ];

  for (const u of users) {
    await prisma.user.create({ data: u });
  }

  console.log('Seeding completed successfully into SQLite database.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
