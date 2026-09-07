import argon2 from "argon2";
import { prisma } from "../src/lib/prisma";
import type { ExamSettings } from "../src/lib/schemas";

async function upsertUser(email: string, name: string, role: "ADMIN" | "PROCTOR" | "STUDENT", password: string) {
  const hash = await argon2.hash(password);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, password: hash },
  });
}

const DEFAULT_SETTINGS: ExamSettings = {
  requireFullscreen: true,
  blockCopyPaste: true,
  allowedTabSwitches: 3,
  aiProctoring: { face: true, object: true, gaze: true },
  recording: false,
};

async function main() {
  const admin = await upsertUser("admin@example.com", "Ada Admin", "ADMIN", "password123");
  await upsertUser("proctor@example.com", "Pat Proctor", "PROCTOR", "password123");
  const student = await upsertUser("student@example.com", "Sam Student", "STUDENT", "password123");

  const existingExam = await prisma.exam.findFirst({ where: { title: "Intro to Algorithms — Midterm" } });
  if (existingExam) {
    console.log("Seed exam already exists, skipping exam creation.");
  } else {
    const exam = await prisma.exam.create({
      data: {
        title: "Intro to Algorithms — Midterm",
        description: "A short sample exam covering sorting and complexity.",
        startsAt: new Date(Date.now() - 5 * 60 * 1000),
        durationMin: 30,
        status: "LIVE",
        settings: DEFAULT_SETTINGS,
        createdBy: admin.id,
        questions: {
          create: [
            {
              order: 0,
              type: "MCQ",
              prompt: "What is the average-case time complexity of quicksort?",
              options: ["O(n)", "O(n log n)", "O(n^2)", "O(log n)"],
              answer: "O(n log n)",
              points: 1,
            },
            {
              order: 1,
              type: "MULTI",
              prompt: "Which of the following are stable sorting algorithms?",
              options: ["Merge sort", "Quicksort", "Bubble sort", "Selection sort"],
              answer: ["Merge sort", "Bubble sort"],
              points: 2,
            },
            {
              order: 2,
              type: "SHORT",
              prompt: "In one sentence, define what makes an algorithm 'in-place'.",
              points: 2,
            },
          ],
        },
      },
    });
    console.log(`Created exam ${exam.id}`);
  }

  console.log("Seed complete. Test accounts (password: password123):");
  console.log(`  admin:   admin@example.com`);
  console.log(`  proctor: proctor@example.com`);
  console.log(`  student: student@example.com (${student.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
