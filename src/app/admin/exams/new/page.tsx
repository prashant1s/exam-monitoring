"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuestionInput } from "@/lib/schemas";

const emptyQuestion = (order: number): QuestionInput => ({
  order,
  type: "MCQ",
  prompt: "",
  options: ["", "", "", ""],
  answer: "",
  points: 1,
});

export default function NewExamPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [requireFullscreen, setRequireFullscreen] = useState(true);
  const [blockCopyPaste, setBlockCopyPaste] = useState(true);
  const [allowedTabSwitches, setAllowedTabSwitches] = useState(3);
  const [aiFace, setAiFace] = useState(true);
  const [aiObject, setAiObject] = useState(true);
  const [aiGaze, setAiGaze] = useState(true);
  const [recording, setRecording] = useState(false);
  const [questions, setQuestions] = useState<QuestionInput[]>([emptyQuestion(0)]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateQuestion(i: number, patch: Partial<QuestionInput>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          startsAt: new Date(startsAt).toISOString(),
          durationMin: Number(durationMin),
          settings: {
            requireFullscreen,
            blockCopyPaste,
            allowedTabSwitches: Number(allowedTabSwitches),
            aiProctoring: { face: aiFace, object: aiObject, gaze: aiGaze },
            recording,
          },
          questions: questions.map((q, i) => ({
            ...q,
            order: i,
            options: q.type === "MCQ" || q.type === "MULTI" ? (q.options ?? []).filter(Boolean) : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create exam");
      router.push(`/admin/exams/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create exam");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900 mb-6">New exam</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Title"><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Description">
              <textarea
                className="w-full rounded-[--radius-sm] border border-neutral-300 p-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-ring/40"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Starts at">
                <Input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </Field>
              <Field label="Duration (min)">
                <Input type="number" min={1} required value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Proctoring settings</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Checkbox label="Require fullscreen" checked={requireFullscreen} onChange={setRequireFullscreen} />
            <Checkbox label="Block copy/paste/right-click" checked={blockCopyPaste} onChange={setBlockCopyPaste} />
            <Field label="Allowed tab switches before auto-flag">
              <Input type="number" min={0} value={allowedTabSwitches} onChange={(e) => setAllowedTabSwitches(Number(e.target.value))} />
            </Field>
            <Checkbox label="AI: face presence/count" checked={aiFace} onChange={setAiFace} />
            <Checkbox label="AI: object detection (phone/book)" checked={aiObject} onChange={setAiObject} />
            <Checkbox label="AI: gaze/head-pose" checked={aiGaze} onChange={setAiGaze} />
            <Checkbox label="Record sessions" checked={recording} onChange={setRecording} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Questions</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => setQuestions((qs) => [...qs, emptyQuestion(qs.length)])}>
              Add question
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {questions.map((q, i) => (
              <div key={i} className="rounded-[--radius-sm] border border-neutral-200 p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-500">
                    {i + 1}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                      onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="rounded-[--radius-sm] border border-neutral-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-ring/40"
                    value={q.type}
                    onChange={(e) => updateQuestion(i, { type: e.target.value as QuestionInput["type"] })}
                  >
                    <option value="MCQ">Multiple choice (single)</option>
                    <option value="MULTI">Multiple choice (multi)</option>
                    <option value="SHORT">Short answer</option>
                    <option value="LONG">Long answer</option>
                    <option value="CODE">Code</option>
                  </select>
                  <Input type="number" min={1} value={q.points} onChange={(e) => updateQuestion(i, { points: Number(e.target.value) })} placeholder="Points" />
                </div>
                <textarea
                  className="w-full rounded-[--radius-sm] border border-neutral-300 p-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-ring/40"
                  placeholder="Prompt"
                  required
                  value={q.prompt}
                  onChange={(e) => updateQuestion(i, { prompt: e.target.value })}
                />
                {(q.type === "MCQ" || q.type === "MULTI") && (
                  <div className="flex flex-col gap-1">
                    {(q.options ?? []).map((opt, oi) => (
                      <Input
                        key={oi}
                        placeholder={`Option ${oi + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const options = [...(q.options ?? [])];
                          options[oi] = e.target.value;
                          updateQuestion(i, { options });
                        }}
                      />
                    ))}
                    <Input
                      placeholder="Correct answer (must match an option exactly)"
                      value={typeof q.answer === "string" ? q.answer : ""}
                      onChange={(e) => updateQuestion(i, { answer: e.target.value })}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create exam"}</Button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-neutral-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-accent" />
      {label}
    </label>
  );
}
