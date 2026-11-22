// Canned lesson used when LEARN_OTG_MOCK=1, so the UI can be tested offline.
export const MOCK_LESSON = `Your heart is two pumps working side by side — here's how.

\`\`\`openui-lang
root = Stack([header, guess, flow, race, check, terms, next])
header = LessonHeader("How does your heart pump blood?", "Two pumps, one heartbeat, about 100,000 times a day", "🫀", "Biology", "berry", "question")
guess = Predict("How much blood does your heart pump each minute at rest?", ["About a cup", "About 5 litres", "About 50 litres"], 1, "Around 5 litres: roughly all the blood in your body passes through the heart every minute.")
flow = Flow("One trip around the body", [{title: "Blood comes home", detail: "Used blood, low on oxygen, flows into the right atrium."}, {title: "Off to the lungs", detail: "The right ventricle squeezes it to the lungs to swap CO₂ for oxygen."}, {title: "Back to the heart", detail: "Oxygen-rich blood returns to the left atrium."}, {title: "Out to the body", detail: "The left ventricle, the strongest chamber, pumps it through the aorta."}], "rail")
race = RaceChart("Heart rate by activity (illustration)", ["0 min", "1 min", "2 min", "3 min", "4 min"], [{name: "Sprinter", values: [70, 120, 160, 180, 175]}, {name: "Jogger", values: [70, 100, 130, 145, 150]}, {name: "Walker", values: [70, 85, 95, 100, 100]}, {name: "Sleeper", values: [60, 58, 57, 56, 55]}], "bpm")
check = Quiz("Which chamber pumps blood out to your whole body?", ["Right atrium", "Right ventricle", "Left ventricle", "Left atrium"], 2, "It's the strongest chamber, on the body side.", "The left ventricle has the thickest wall because it pushes blood around the whole body.", "tiles")
terms = KeyTerms([{term: "Atrium", meaning: "Upper chamber that receives blood"}, {term: "Ventricle", meaning: "Lower chamber that pumps blood out"}], "chips")
next = NextSteps(["Why does your pulse rise when you exercise?", "Go deeper: how do heart valves work?"])
\`\`\`
`;
