import type { ComponentType } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type C = ComponentType<any>;

export type Lib = {
  Hero: C;
  BigIdea: C;
  QuickAnswer: C;
  Flow: C;
  WorkedExample: C;
  Compare: C;
  Analogy: C;
  ConceptMap: C;
  Layers: C;
  Timeline: C;
  StatGrid: C;
  Scale: C;
  Explorable: C;
  Predict: C;
  Quiz: C;
  Recall: C;
  FlipCards: C;
  MythFact: C;
  KeyTerms: C;
  Takeaways: C;
  NextSteps: C;
  Activity: C;
  Sources: C;
  Button: C;
  Chip: C;
  Icon: C;
};

export const MOODS = ["forest", "sun", "lagoon", "berry", "clay", "graphite"] as const;
export type Mood = (typeof MOODS)[number];
