// Canned course data for LEARN_OTG_MOCK=1 / ?mock=1, so the course flow can be tried offline.
/** No NVIDIA or Groq key on this server: run in demo mode so a fresh copy works with no setup. */
export const noKeys = () => !process.env.NVIDIA_API_KEY && !process.env.GROQ_API_KEY;
export const isMock = (flag?: boolean) => process.env.LEARN_OTG_MOCK === "1" || noKeys() || (flag === true && process.env.NODE_ENV !== "production");

export function mockOutline(topic: string) {
  const t = topic.trim() || "Personal finance basics";
  return {
    title: t.length > 60 ? t.slice(0, 57) + "…" : t.charAt(0).toUpperCase() + t.slice(1),
    blurb: "A short, practical course that builds one idea at a time.",
    mood: "sun",
    level: "Beginner",
    digest: "",
    sections: [
      {
        title: "Foundations",
        summary: "Understand the core ideas and the words people use for them.",
        lessons: [
          { title: "What is it, and why does it matter?", summary: "The big picture and why it is worth learning.", notes: "", plan: [{ title: "The big picture", goal: "Introduce the idea" }, { title: "Watch it work", goal: "A simulation and a sorting game" }, { title: "Put it to work", goal: "A scenario and a typed answer", adaptive: true }] },
          { title: "The key terms you will meet", summary: "A plain-language glossary of the essentials.", notes: "" },
          { title: "How does it work step by step?", summary: "The basic process from start to finish.", notes: "" },
        ],
      },
      {
        title: "Putting it to work",
        summary: "Use the ideas on realistic examples.",
        lessons: [
          { title: "A worked example", summary: "Solve a typical problem together.", notes: "" },
          { title: "What do the numbers look like over time?", summary: "See growth and change as a race.", notes: "" },
        ],
      },
    ],
  };
}

export function mockQuestions(count: number) {
  return Array.from({ length: Math.max(1, count) }, (_, i) => ({
    q: `Sample question ${i + 1}: which statement is true?`,
    options: ["The first idea", "The second idea", "The third idea", "None of these"],
    answer: i % 4,
    why: "This is a demo question so you can try the quiz flow without a model.",
  }));
}
