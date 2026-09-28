import { getPrisma } from "../src/prisma.js";
import { allocateTicketNumber } from "../src/utils/ticketNumber.js";
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

  // 4. Sample Realistic Queue Tickets
  const alice = await prisma.user.findUnique({ where: { email: "alice.smith@university.edu" } });
  const bob = await prisma.user.findUnique({ where: { email: "bob.jones@university.edu" } });
  const charlie = await prisma.user.findUnique({ where: { email: "charlie.brown@university.edu" } });
  const staff1 = await prisma.user.findUnique({ where: { email: "staff1@university.edu" } });
  const staff2 = await prisma.user.findUnique({ where: { email: "staff2@university.edu" } });
  const accountCategory = await prisma.category.findFirst({ where: { name: "Account and Access" } });
  const networkCategory = await prisma.category.findFirst({ where: { name: "Network" } });
  const softwareCategory = await prisma.category.findFirst({ where: { name: "Software" } });
  const hardwareCategory = await prisma.category.findFirst({ where: { name: "Hardware" } });
  const portalSystem = await prisma.relatedSystem.findFirst({ where: { name: "Student Portal" } });
  const wifiSystem = await prisma.relatedSystem.findFirst({ where: { name: "Campus Wi-Fi" } });
  const canvasSystem = await prisma.relatedSystem.findFirst({ where: { name: "Canvas LMS" } });

  if (alice && bob && charlie && accountCategory && networkCategory && softwareCategory && hardwareCategory && portalSystem && wifiSystem && canvasSystem) {
    const seedTickets = [
      {
        requesterId: alice.id,
        categoryId: accountCategory.id,
        relatedSystemId: portalSystem.id,
        summary: "Cannot access Student Portal login page",
        description: "Attempting to log into the Student Portal results in a 500 server error page.",
        requestedPriority: "High",
        itPriority: "High",
        currentStatus: "New",
        assigneeId: null,
      },
      {
        requesterId: bob.id,
        categoryId: networkCategory.id,
        relatedSystemId: wifiSystem.id,
        summary: "Campus Wi-Fi disconnects frequently in Library",
        description: "Wi-Fi connection drops every 10-15 minutes when connected to campus-eduroam.",
        requestedPriority: "Medium",
        itPriority: "Medium",
        currentStatus: "In Progress",
        assigneeId: staff1 ? staff1.id : null,
      },
      {
        requesterId: charlie.id,
        categoryId: softwareCategory.id,
        relatedSystemId: canvasSystem.id,
        summary: "Canvas assignment submission fails with upload timeout",
        description: "PDF upload times out on Canvas LMS assignment portal.",
        requestedPriority: "Urgent",
        itPriority: "Urgent",
        currentStatus: "In Progress",
        assigneeId: staff2 ? staff2.id : null,
      },
      {
        requesterId: alice.id,
        categoryId: hardwareCategory.id,
        relatedSystemId: portalSystem.id,
        summary: "Monitor display flicker on Workstation 4",
        description: "The secondary monitor connected to lab workstation 4 flickers constantly.",
        requestedPriority: "Low",
        itPriority: "Low",
        currentStatus: "New",
        assigneeId: null,
      },
      {
        requesterId: bob.id,
        categoryId: accountCategory.id,
        relatedSystemId: portalSystem.id,
        summary: "MFA Authentication code not receiving via SMS",
        description: "Multi-factor authentication SMS codes are delayed by over 30 minutes.",
        requestedPriority: "High",
        itPriority: "High",
        currentStatus: "Waiting for Requester",
        assigneeId: staff1 ? staff1.id : null,
      },
      {
        requesterId: charlie.id,
        categoryId: networkCategory.id,
        relatedSystemId: wifiSystem.id,
        summary: "VPN Client error code 403 on remote connect",
        description: "Cisco AnyConnect VPN throws authentication error 403 when off campus.",
        requestedPriority: "Medium",
        itPriority: null,
        currentStatus: "New",
        assigneeId: null,
      },
    ];

    for (const ticketData of seedTickets) {
      const existingTicket = await prisma.ticket.findFirst({
        where: {
          summary: ticketData.summary,
          requesterId: ticketData.requesterId,
        },
      });

      if (!existingTicket) {
        const ticketNumber = await allocateTicketNumber(prisma);
        await prisma.ticket.create({
          data: {
            ticketNumber,
            ...ticketData,
          },
        });
      }
    }
    console.log("Sample tickets seeded successfully.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
