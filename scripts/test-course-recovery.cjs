const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('../node_modules/typescript');
const root = process.cwd();
require.extensions['.ts'] = (module, path) => module._compile(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, resolveJsonModule: true, esModuleInterop: true } }).outputText, path);
const originalLoad = Module._load;
const mocks = {
  'server-only': {},
  '@/lib/providers': { getProvider: id => ({ id, name: id, apiKey: 'test-only', baseUrl: 'https://provider.example.test' }), providerKeyName: () => 'TEST_KEY' },
  '@/lib/component-library': { pickComponents: () => ({ text: '', count: 0 }), saveFromLesson: () => 0 },
  '@/lib/memory': { compactHistory: () => ({ history: [], lessons: [] }), learnerRecord: () => '', textOf: x => x, RECALL_TOOL: {} },
  '@/lib/research': { isFollowUp: () => false, needsFreshInfo: () => false },
  '@/lib/quick': { quickAvailable: () => false },
  '@/lib/store': { lessonCache: { get: () => undefined, set: () => {} }, normalizeQuestion: x => x, HOUR: 3600000, DAY: 86400000 },
  '@/lib/tools': { TOOL_DEFS: [{}], searchProviderName: () => 'Test provider' },
};
Module._load = function(name, parent, isMain) {
  if (name in mocks) return mocks[name];
  if(name === './providers' && parent?.filename.startsWith(root+'/src/lib/'))return mocks['@/lib/providers'];
  if (name.startsWith('@/')) name = `${root}/src/${name.slice(2)}`;
  return originalLoad.call(this, name, parent, isMain);
};
const data = new Map();
const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
global.window = { localStorage: storage, sessionStorage: storage, location: { search: '' }, dispatchEvent: () => {} };
global.localStorage = storage;
global.CustomEvent = class {};
const { DEFAULT_COURSE_OPTIONS: defaults } = require('../src/lib/course-types.ts');
const { courseSize } = require('../src/lib/course-size.ts');
const { defaultPlan, lessonPages, putCourse, getCourse } = require('../src/lib/courses.ts');
const {hasNamedArguments}=require("../src/lib/lesson-code.ts");
const { getSystemPrompt, buildContext } = require('../src/lib/prompt.ts');
const { POST } = require('../src/app/api/chat/route.ts');
const { createCourse } = require('../src/lib/course-gen.ts');
const sse = (content, finish = 'stop') => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: finish }] })}\n\ndata: [DONE]\n\n`);
const request = (extra = {}) => new Request('http://app.example.test/api/chat', { method: 'POST', body: JSON.stringify({ model: 'z-ai/glm-5.3', params: { reasoning_effort: 'off' }, messages: [{ role: 'user', content: 'Explain a fixed cost.' }], browsing: false, instant: false, ...extra }) });
const events = async response => (await response.text()).trim().split('\n').map(line => JSON.parse(line));

(async () => {
  const compactPrompt=getSystemPrompt(true);
  for(const name of Object.keys(require("../src/generated/spec.json").components))assert(compactPrompt.includes(name+"("),`compact prompt retains ${name}`);
  assert.match(compactPrompt,/POSITIONAL arguments/);
  assert(hasNamedArguments('```openui-lang\nroot = Stack([header])\nheader = LessonHeader(title="Wrong")\n```'));
  assert(!hasNamedArguments('```openui-lang\nroot = Stack([header])\nheader = LessonHeader("Text mentioning (title=value)", "Subtitle", "", "", "sun", "question")\n```'));
  assert.deepEqual(courseSize(defaults), { lessons: 12, pages: 3 });
  assert.deepEqual(courseSize({ ...defaults, length: 'short' }), { lessons: 6, pages: 2 });
  assert.deepEqual(courseSize({ ...defaults, length: 'detailed' }), { lessons: 24, pages: 5 });
  const manual = { ...defaults, sizeMode: 'manual', lessonCount: 1, pagesPerLesson: 1, sourcePolicy: 'strict' };
  assert.deepEqual(courseSize(manual), { lessons: 1, pages: 1 });
  assert.equal(defaultPlan({ title: 'An article', summary: 'Learn one idea' }, manual).length, 1);
  assert.equal(lessonPages({ id: 'short-plan', title: 'Practice', summary: '', plan: [{ title: 'Opening', goal: 'Introduce' }] }, { ...manual, pagesPerLesson: 8 }).length, 8);
  const strict = buildContext({ browsing: false, course: { title: 'Test', level: 'Beginner', lesson: 'Test', section: 'Test', index: '1', summary: 'Test', outline: '', sourcePolicy: 'strict', contextDigest: 'One supplied fact.' } });
  assert.match(strict, /Use ONLY the learner-supplied material/);
  assert.doesNotMatch(strict, /Answer from your own knowledge/);

  let calls = [];
  global.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); return sse(''); };
  let result = await events(await POST(request()));
  assert.equal(calls.length, 2, 'empty primary tries the backup once');
  assert(result.some(e => e.type === 'error'));
  assert(!result.some(e => e.type === 'done'), 'empty replies cannot look successful');
  assert.equal(calls[0].reasoning_effort, 'low');
  assert.equal(calls[0].chat_template_kwargs, undefined, 'GLM never receives thinking-off template flags');

  calls = [];
  const realTimeout = global.setTimeout;
  global.setTimeout = (callback, delay, ...args) => realTimeout(callback, delay === 45000 ? 5 : delay, ...args);
  global.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
    return sse('A complete answer.\n```openui-lang\nroot = Stack([])\n```');
  };
  result = await events(await POST(request()));
  global.setTimeout = realTimeout;
  assert.equal(calls.length, 2);
  assert(result.some(e => e.type === 'notice' && /backup/.test(e.text)));
  assert(result.some(e => e.type === 'content'));
  assert(result.some(e => e.type === 'done'));
  assert(!result.some(e => e.type === 'error'));

  calls=[];
  global.fetch=async (_url,options)=>{calls.push(JSON.parse(options.body));return sse('A recovered lesson.');};
  result=await events(await POST(request()));
  assert.equal(calls.length,1,'a recently stalled model is bypassed during recovery');
  assert(result.some(e=>e.type==='notice' && /temporarily unresponsive/.test(e.text)));
  global.fetch = async () => sse('Incomplete answer', 'length');
  result = await events(await POST(request({ allowBackup: false })));
  assert(result.some(e => e.type === 'error' && /answer limit/.test(e.message)));
  assert(!result.some(e => e.type === 'done'));

  const outlineApi=require('../src/app/api/course/outline/route.ts').POST;
  const outline={title:'A precise course',sections:[{title:'Ideas',lessons:Array.from({length:3},(_,i)=>({title:`Idea ${i+1}`,summary:'A supplied fact',pages:['One page | Practice a supplied fact']}))}]};
  let plannerRequest;
  global.fetch=async (_url,options)=>{plannerRequest=JSON.parse(options.body);return sse(JSON.stringify(outline));};
  result=await events(await outlineApi(new Request('http://app.example.test/api/course/outline',{method:'POST',body:JSON.stringify({model:'z-ai/glm-5.3',fast:false,options:{...manual,lessonCount:2},topic:'Supplied facts',files:[{name:'Public source',text:'A supplied fact.'}]})})));
  assert.equal(result.find(e=>e.type==='done').outline.sections[0].lessons.length,2,'excess planned lessons are trimmed to the exact target');
  assert.match(plannerRequest.messages[1].content,/SOURCE POLICY: Use only the supplied sources/);
  assert.match(plannerRequest.messages[1].content,/EXACTLY 2 lessons/);
  const quizApi=require('../src/app/api/course/quiz/route.ts').POST;
  global.fetch=async (_url,options)=>{plannerRequest=JSON.parse(options.body);return sse(JSON.stringify({questions:[{q:'What is supported?',options:['A','B'],answer:0,why:'Source fact'}]}));};
  const quiz=await quizApi(new Request('http://app.example.test/api/course/quiz',{method:'POST',body:JSON.stringify({model:'z-ai/glm-5.3',fast:false,sourcePolicy:'strict',count:1,courseTitle:'Test',kind:'lesson',scopeTitle:'Test',lessons:[{title:'Test',summary:'Source fact'}]})}));
  assert.equal(quiz.status,200);
  assert.match(plannerRequest.messages[1].content,/must use only supplied material/);

  putCourse({ id: 'reference', title: 'Existing course', contextDigest: 'Public reference fact', options: defaults, sections: [{ id: 's', title: 'Source', lessons: [{ id: 'l', title: 'Existing idea', summary: 'Reference explanation', done: true, pages: [{ id: 'p', title: 'Example', status: 'ready', code: 'root = Stack([])', answers: [{ response: 'PRIVATE_ANSWER_MARKER' }] }] }] }], quizzes: [], files: [] });
  let outlineRequest;
  global.fetch = async (_url, options) => { outlineRequest = JSON.parse(options.body); return new Response(JSON.stringify({ type: 'done', outline: { title: 'One article', mood: 'forest', level: 'Beginner', blurb: 'A focused article', digest: 'Public reference fact', sections: [{ title: 'One idea', summary: '', lessons: [{ title: 'An idea', summary: 'Explain it', plan: [{ title: 'Article', goal: 'Explain and practice' }] }] }] } }) + '\n'); };
  const id = await createCourse({ topic: 'An idea', goal: '', level: 'Beginner', options: manual, referenceCourseIds: ['reference'], files: [] });
  assert.equal(outlineRequest.options.sourcePolicy, 'strict');
  assert.match(outlineRequest.files[0].text, /Public reference fact/);
  assert.doesNotMatch(outlineRequest.files[0].text, /PRIVATE_ANSWER_MARKER/);
  assert.equal(getCourse(id).sections[0].lessons[0].pages.length, 1);
  assert.deepEqual(getCourse(id).referenceCourseIds, ['reference']);
  console.log('PASS: automatic and exact sizing, one-page articles, exact page plans, strict context, GLM parameters, timeout recovery, empty/truncated reply errors, reference grounding and private-answer exclusion.');
})().catch(error => { console.error(error); process.exitCode = 1; });
