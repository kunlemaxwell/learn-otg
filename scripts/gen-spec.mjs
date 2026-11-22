// Builds src/generated/spec.json: the lean component set the model is told about
// (a learning-focused subset of OpenUI plus Learn OTG's own lesson components).
// Runs automatically before `dev` and `build`.
import { writeFileSync, mkdirSync } from "node:fs";
import { createLibrary, defineComponent } from "@openuidev/lang-core";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { LESSON_BUILTINS, LESSON_COMPONENT_DEFS } from "../src/lib/lesson-schemas.mjs";

const builtins = LESSON_BUILTINS.map((name) => {
  const c = openuiLibrary.components[name];
  if (!c) throw new Error(`OpenUI component ${name} not found`);
  return c;
});
const custom = LESSON_COMPONENT_DEFS.map((d) => defineComponent({ ...d, component: null }));

const lib = createLibrary({ components: [...builtins, ...custom], root: "Stack" });
const spec = lib.toSpec();
mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/spec.json", JSON.stringify(spec, null, 2));
console.log(`Lesson spec written: ${Object.keys(spec.components).length} components`);
