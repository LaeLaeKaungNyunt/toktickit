import { getPrisma } from "../src/prisma.js";
import bcrypt from "bcryptjs";

async function main() {
  const prisma = getPrisma();

  // 1. Categories (4 required items preserved from Lab 1)
  const categories = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("Categories seeded successfully.");

  // 2. Users (Requesters, IT Staff, Administrators)
  const defaultPasswordHash = await bcrypt.hash("Password123!", 10);
  const initialPasswordHash = await bcrypt.hash("InitialPassword123!", 10);

  const users = [
    {
      name: "Alice Smith",
      email: "alice.smith@university.edu",
      role: "Requester",
      isActive: true,
      mustChangePassword: false,
      passwordHash: defaultPasswordHash,
    },
    {
      name: "Bob Jones",
      email: "bob.jones@university.edu",
      role: "Requester",
      isActive: true,
      mustChangePassword: false,
      passwordHash: defaultPasswordHash,
    },
    {
      name: "Charlie Brown",
      email: "charlie.brown@university.edu",
      role: "Requester",
      isActive: true,
      mustChangePassword: false,
      passwordHash: defaultPasswordHash,
    },
    {
      name: "Diana Prince",
      email: "diana.prince@university.edu",
      role: "Requester",
      isActive: true,
      mustChangePassword: false,
      passwordHash: defaultPasswordHash,
    },
    {
      name: "Eve Mallary (Inactive)",
      email: "eve.mallary@university.edu",
      role: "Requester",
      isActive: false,
      mustChangePassword: false,
      passwordHash: defaultPasswordHash,
    },
    {
      name: "Initial Password User",
      email: "initial.user@university.edu",
      role: "Requester",
      isActive: true,
      mustChangePassword: true,
      passwordHash: initialPasswordHash,
    },
    {
      name: "Sam Staff",
      email: "staff1@university.edu",
      role: "IT Staff",
      isActive: true,
      mustChangePassword: false,
      passwordHash: defaultPasswordHash,
    },
    {
      name: "Alex Tech",
      email: "staff2@university.edu",
      role: "IT Staff",
      isActive: true,
      mustChangePassword: false,
      passwordHash: defaultPasswordHash,
    },
    {
      name: "Admin User",
      email: "admin@university.edu",
      role: "Administrator",
      isActive: true,
      mustChangePassword: false,
      passwordHash: defaultPasswordHash,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
      },
      create: user,
    });
  }
  console.log("Users seeded successfully.");

  // 3. Related Systems (at least 6 realistic active items)
  const relatedSystems = [
    { name: "Student Portal", isActive: true },
    { name: "Canvas LMS", isActive: true },
    { name: "Campus Wi-Fi", isActive: true },
    { name: "Email & Office 365", isActive: true },
    { name: "VPN Gateway", isActive: true },
    { name: "Library Database", isActive: true },
  ];

  for (const sys of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name: sys.name },
      update: {
        isActive: sys.isActive,
      },
      create: sys,
    });
  }
  console.log("Related Systems seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
