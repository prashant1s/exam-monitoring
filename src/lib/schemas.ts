import { z } from "zod";

export const examSettingsSchema = z.object({
  requireFullscreen: z.boolean().default(true),
  blockCopyPaste: z.boolean().default(true),
  allowedTabSwitches: z.number().int().min(0).default(3),
  aiProctoring: z.object({
    face: z.boolean().default(true),
    object: z.boolean().default(true),
    gaze: z.boolean().default(true),
  }).default({ face: true, object: true, gaze: true }),
  recording: z.boolean().default(false),
});
export type ExamSettings = z.infer<typeof examSettingsSchema>;

export const questionSchema = z.object({
  order: z.number().int().min(0),
  type: z.enum(["MCQ", "MULTI", "SHORT", "LONG", "CODE"]),
  prompt: z.string().min(1),
  options: z.array(z.string()).optional(),
  answer: z.unknown().optional(),
  points: z.number().int().min(1).default(1),
});
export type QuestionInput = z.infer<typeof questionSchema>;

export const createExamSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startsAt: z.coerce.date(),
  durationMin: z.number().int().min(1),
  settings: examSettingsSchema.optional().default({
    requireFullscreen: true,
    blockCopyPaste: true,
    allowedTabSwitches: 3,
    aiProctoring: { face: true, object: true, gaze: true },
    recording: false,
  }),
  questions: z.array(questionSchema).optional().default([]),
});
export type CreateExamInput = z.infer<typeof createExamSchema>;

export const answerUpsertSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      value: z.unknown(),
    })
  ),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = loginSchema.extend({
  name: z.string().min(1),
  role: z.enum(["ADMIN", "PROCTOR", "STUDENT"]).default("STUDENT"),
});
