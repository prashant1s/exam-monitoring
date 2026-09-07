import { create } from "zustand";

export type RuntimeQuestion = {
  id: string;
  order: number;
  type: "MCQ" | "MULTI" | "SHORT" | "LONG" | "CODE";
  prompt: string;
  options?: string[] | null;
  points: number;
};

type ExamStatus = "idle" | "in_progress" | "submitting" | "submitted";

interface ExamState {
  sessionId: string | null;
  questions: RuntimeQuestion[];
  currentIndex: number;
  answers: Record<string, unknown>;
  flagged: Set<string>;
  timeLeft: number; // seconds
  status: ExamStatus;

  init: (sessionId: string, questions: RuntimeQuestion[], timeLeft: number) => void;
  setAnswer: (questionId: string, value: unknown) => void;
  toggleFlag: (questionId: string) => void;
  goto: (index: number) => void;
  next: () => void;
  prev: () => void;
  tick: () => void;
  setStatus: (status: ExamStatus) => void;
}

export const useExamStore = create<ExamState>((set, get) => ({
  sessionId: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  flagged: new Set(),
  timeLeft: 0,
  status: "idle",

  init: (sessionId, questions, timeLeft) =>
    set({ sessionId, questions, timeLeft, currentIndex: 0, answers: {}, flagged: new Set(), status: "in_progress" }),

  setAnswer: (questionId, value) =>
    set((state) => ({ answers: { ...state.answers, [questionId]: value } })),

  toggleFlag: (questionId) =>
    set((state) => {
      const flagged = new Set(state.flagged);
      if (flagged.has(questionId)) flagged.delete(questionId);
      else flagged.add(questionId);
      return { flagged };
    }),

  goto: (index) =>
    set((state) => ({ currentIndex: Math.max(0, Math.min(index, state.questions.length - 1)) })),

  next: () => get().goto(get().currentIndex + 1),
  prev: () => get().goto(get().currentIndex - 1),

  tick: () => set((state) => ({ timeLeft: Math.max(0, state.timeLeft - 1) })),

  setStatus: (status) => set({ status }),
}));
