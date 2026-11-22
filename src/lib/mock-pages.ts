// Canned course pages for demo mode (?mock=1). They exercise every interactive component.

const P1 = `Here's the big picture first.

\`\`\`openui-lang
root = Stack([header, idea, guess, flow, check])
header = LessonHeader("How does compound interest work?", "Interest that earns interest", "%", "Money basics", "sun", "question")
idea = BigIdea("Each year you earn interest on your money and on the interest you already earned.", "", "banner")
guess = Predict("$1,000 at 10% a year for 20 years ends up closest to…", ["$3,000", "$4,500", "$6,700"], 2, "It grows to about $6,727. Simple interest would give only $3,000.")
flow = Flow("One year of compounding", [{title: "Start with a balance", detail: "Say $1,000 in a savings account."}, {title: "Interest is added", detail: "At 10%, the bank adds $100."}, {title: "The base grows", detail: "Next year's interest is worked out on $1,100."}, {title: "Repeat", detail: "Each year adds a little more than the last."}], "rail")
check = Quiz("After two years at 10%, $1,000 becomes…", ["$1,200", "$1,210", "$1,100"], 1, "Year two earns interest on $1,100.", "Year one adds $100, year two adds $110, so you have $1,210.", "tiles")
\`\`\``;

const P2 = `Play with the numbers, then sort a few ideas.

\`\`\`openui-lang
root = Stack([title, sim, sort])
title = PageTitle("Watch your money grow", "Page 2 of 3")
sim = Simulation("Compound interest", "Change the rate and the years. The curve bends because each year's interest earns interest too.", [{key: "p", label: "Starting amount", min: 100, max: 10000, step: 100, initial: 1000, unit: "$"}, {key: "rate", label: "Interest rate", min: 1, max: 15, step: 0.5, initial: 6, unit: "%"}, {key: "years", label: "Years", min: 1, max: 40, step: 1, initial: 10}], [{label: "Final amount", formula: "p * (1 + rate / 100) ^ years", unit: "$", decimals: 0}, {label: "Interest earned", formula: "p * (1 + rate / 100) ^ years - p", unit: "$", decimals: 0}], {x: "years", y: "Final amount"}, [{when: "years >= 12 and rate >= 6", text: "At 6% your money roughly doubles every 12 years: the rule of 72."}])
sort = SortGame("Which grow by compounding?", ["Compounds", "Doesn't compound"], [{text: "A savings account that pays interest monthly", bucket: "Compounds"}, {text: "Cash under a mattress", bucket: "Doesn't compound"}, {text: "Credit card debt you don't pay off", bucket: "Compounds"}, {text: "A fixed $50 monthly allowance", bucket: "Doesn't compound"}, {text: "Reinvested share dividends", bucket: "Compounds"}], "Anything where the growth is added back to the base compounds, including debt.")
\`\`\``;

const P3 = `Now use it in a real decision.

\`\`\`openui-lang
root = Stack([title, scn, open, take, next])
title = PageTitle("Put it to work", "Page 3 of 3")
scn = Scenario("Your first salary", "a new graduate with $200 a month spare", [{situation: "Your bank offers a savings account at 4% and a friend suggests keeping cash for flexibility.", choices: [{label: "Open the savings account and set up a monthly transfer", outcome: "The habit runs on its own and the interest starts compounding straight away.", score: 2}, {label: "Keep it as cash for now", outcome: "Flexible, but inflation slowly eats it and nothing compounds.", score: 0}, {label: "Save only what is left at the end of the month", outcome: "Some months there is nothing left, so growth is patchy.", score: 1}]}, {situation: "A store card offers 0% for 3 months, then 29% a year.", choices: [{label: "Use it only if you can clear it within 3 months", outcome: "You keep the free period without letting 29% compound against you.", score: 2}, {label: "Use it and pay the minimum", outcome: "Debt compounds just like savings do, only faster and against you.", score: 0}]}], "Compounding works for you in savings and against you in debt. Start early and keep debt short.")
open = OpenQuestion("Why does starting to save five years earlier make such a big difference?", "Because the extra years let interest earn interest for longer, and the biggest gains come at the end of the curve.", "Look at the shape of the curve from page 2.", "short")
take = Takeaways(["Interest is added to the base, so growth speeds up over time", "Time matters more than the rate for most savers", "Debt compounds too, usually at higher rates"], "checklist")
next = NextSteps(["How does compound interest apply to a mortgage?", "Go deeper: what is the rule of 72?"])
\`\`\``;

const P4 = `A quick round of practice to lock it in.

\`\`\`openui-lang
root = Stack([title, match, order, cards, photo])
title = PageTitle("Practice round", "Page 4 of 4")
match = MatchGame("Match the term to its meaning", [{left: "Principal", right: "The money you start with"}, {left: "Rate", right: "The percentage added each period"}, {left: "Compounding", right: "Earning interest on interest"}, {left: "Rule of 72", right: "72 ÷ rate ≈ years to double"}])
order = OrderGame("Put one year of compounding in order", ["Start with a balance", "Interest is worked out", "Interest is added to the balance", "Next year starts from the bigger balance"], "Each year begins where the last one ended, which is why the growth speeds up.")
cards = FlipCards("Quick recall", [{front: "Years to double at 8%?", back: "About 9 (72 ÷ 8)"}, {front: "Does debt compound?", back: "Yes, often at higher rates than savings"}, {front: "Biggest lever for most savers?", back: "Time: start early"}])
photo = PhotoAnswer("Sketch how $1,000 grows over 30 years at 7%, then send a photo.", ["A curve that gets steeper over time", "Roughly $2,000 around year 10", "Roughly $7,600 at year 30"], "A rough hand sketch is fine.")
\`\`\``;

export const MOCK_PAGES = [P1, P2, P3, P4];

/** A demo page for a course lesson. Adaptive pages say they adapted. */
export function mockPage(index: number, total: number, answers?: string): string {
  let text = MOCK_PAGES[Math.min(index, MOCK_PAGES.length - 1)];
  if (index > 0 && index === total - 1 && index < 2) text = P3; // short lessons still end with a wrap-up
  text = text.replace(/Page \d of \d/, `Page ${index + 1} of ${total}`);
  if (answers) text = text.replace(/^[^\n]*/, "I adapted this page to your answers so far.");
  return text;
}
