import type { CourseOptions } from "./course-types";

export function courseSize(options: CourseOptions) {
  const length = options.length ?? "medium";
  const auto = { short: { lessons: 6, pages: 2 }, medium: { lessons: 12, pages: 3 }, detailed: { lessons: 24, pages: 5 } }[length];
  const clamp = (n: unknown, fallback: number, max: number) => typeof n === "number" && Number.isFinite(n) ? Math.max(1, Math.min(max, Math.round(n))) : fallback;
  return options.sizeMode === "manual"
    ? { lessons: clamp(options.lessonCount, 12, 40), pages: clamp(options.pagesPerLesson, 3, 8) }
    : auto;
}

export function sizedOptions(options: CourseOptions): CourseOptions {
  const size = courseSize(options);
  return { ...options, pagesPerLesson: size.pages };
}
