import { getPrisma } from "../src/prisma.js";

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

  // 2. Development Requesters (at least 4 active, at least 1 inactive)
  const requesters = [
    {
      displayName: "Alice Smith",
      email: "alice.smith@university.edu",
      isActive: true,
    },
    {
      displayName: "Bob Jones",
      email: "bob.jones@university.edu",
      isActive: true,
    },
    {
      displayName: "Charlie Brown",
      email: "charlie.brown@university.edu",
      isActive: true,
    },
    {
      displayName: "Diana Prince",
      email: "diana.prince@university.edu",
      isActive: true,
    },
    {
      displayName: "Eve Mallary (Inactive)",
      email: "eve.mallary@university.edu",
      isActive: false,
    },
  ];

  for (const req of requesters) {
    await prisma.developmentRequester.upsert({
      where: { email: req.email },
      update: {
        displayName: req.displayName,
        isActive: req.isActive,
      },
      create: req,
    });
  }
  console.log("Development Requesters seeded successfully.");

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
