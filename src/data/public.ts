export const site = 'https://danilostoletovic.com';

export interface Source {
  label: string;
  url: string;
}

export interface Entry {
  id: string;
  title: string;
  summary: string;
  sources: readonly Source[];
}

export interface ProfileLink extends Entry {
  username: string;
  category: 'Professional' | 'Open source' | 'Research' | 'Social' | 'Distribution';
  url: string;
  identity: 'personal' | 'project';
  icon: string;
  primary?: boolean;
}

export interface Project extends Entry {
  status: 'Released' | 'Open-source project' | 'Alpha' | 'Prototype' | 'Experiment';
  category: 'Robotics' | 'Apps' | 'Web & AI' | 'Systems';
  stack: readonly string[];
  role: string;
  includeInCv?: boolean;
  links: readonly Source[];
  image?: { file: string; alt: string; width: number; height: number };
}

export interface CaseStudy extends Entry {
  project: string;
  relevantToClients?: boolean;
  problem: string;
  constraints: string;
  decisions: string;
  implementation: string;
  results: string;
  lessons: string;
}

export interface Publication extends Entry {
  authors: readonly { givenName: string; familyName: string; orcid?: string }[];
  date: string;
  venue: string;
  status: 'Published' | 'Submitted' | 'In progress' | 'Unpublished';
  doi?: string;
  doiRegistration?: 'pending';
  publicationType?: 'Original scientific paper';
  proceedings?: {
    isbn: string;
    firstPage: number;
    location: string;
    organizers: readonly string[];
    format: 'Print';
  };
  project?: string;
}

export interface Achievement extends Entry {
  organizer: string;
  date: string;
  project?: string;
}

export interface NewsItem extends Entry {
  publisher: string;
  date: string;
  url: string;
  mention: 'Direct' | 'Project';
  project?: string;
}

export interface Service extends Entry {
  deliverables: readonly string[];
}

export const source = (label: string, url: string): Source => ({ label, url });
const github = 'https://github.com/danilostoletovic';
const lab = 'https://github.com/smartvehiclelab';
const repository = (name: string) => source('Source code', `${github}/${name}`);
const previousPortfolio = source('Earlier public portfolio', 'https://github.com/danilostoletovic/portfolio/tree/main/en');
const robotics = source('SmartVehicle project documentation', 'https://smartvehicle.dev/');
const roboticsCode = source('Android control station', `${lab}/android-client`);
const award = source('Official Galaksija Cup results', 'https://galaksijakup.rs/pobednici-galaksija-kupa-2026/');
const school = source('ETŠ Nikola Tesla', 'https://etstesla.ni.ac.rs/10-republicko-takmicenje-ucenika-elektrotehnickih-skola-srbije-galaksija-kup/');
const met = source('Metropolitan University results', 'https://www.metropolitan.ac.rs/novosti/mladi-it-talenti-stvarali-prve-digitalne-projekte-na-make-it-day-met-2026/');
const autoDarkStore = source('Microsoft Store', 'https://apps.microsoft.com/detail/9PMGPB2JQQWT');
const autoBrightStore = source('Microsoft Store', 'https://apps.microsoft.com/detail/9NK5LM17C8ZM');
const portfolioNotes = (name: string) => source('Public engineering notes', `https://github.com/danilostoletovic/portfolio/tree/main/en/case-studies/${name}`);

const academicAuthor = { givenName: 'Danilo', familyName: 'Stoletović', orcid: '0009-0008-4855-9109' } as const;
export const orcidUrl = (id: string) => `https://orcid.org/${id}`;

export const person = {
  ...academicAuthor,
  name: `${academicAuthor.givenName} ${academicAuthor.familyName}`,
  alternateNames: ['Danilo Stoletovic', 'Данило Столетовић'],
  title: 'Independent developer & systems builder',
  location: 'Niš, Serbia',
  telephone: '+381677732060',
  email: 'danilo@danilostoletovic.com',
  summary: 'I build applications, websites, and the systems that run them. My work spans the web, mobile, Windows, and embedded computer vision.',
  portrait: '/images/danilo.avif',
  sources: [previousPortfolio, source('GitHub', github), school],
} as const;

export const skills = [
  { title: 'Applications', items: ['Kotlin', 'Jetpack Compose', 'Flutter', 'Dart', 'C#', '.NET'] },
  { title: 'Web & integration', items: ['TypeScript', 'Astro', 'React', 'Node.js', 'Python', 'APIs'] },
  { title: 'Systems', items: ['Linux', 'Docker', 'Cloudflare', 'GitHub Actions', 'Rust'] },
] as const;

export const experience: readonly Entry[] = [{
  id: 'independent-development',
  title: 'Independent software development',
  summary: 'Freelance and project-based work across websites, applications, AI integrations, and deployment. I work directly with clients on scope, implementation, and handover.',
  sources: [previousPortfolio, source('Upwork', 'https://www.upwork.com/freelancers/danilostoletovic')],
}];

export const education: readonly Entry[] = [{
  id: 'ets-nikola-tesla',
  title: 'ETŠ Nikola Tesla, Niš',
  summary: 'Electrical and computer science studies.',
  sources: [school, previousPortfolio],
}];

export const profiles: readonly ProfileLink[] = [
  { id: 'github', title: 'GitHub', username: 'danilostoletovic', category: 'Open source', icon: 'github', identity: 'personal', primary: true, url: github, summary: 'Public repositories and releases.', sources: [previousPortfolio] },
  { id: 'linkedin', title: 'LinkedIn', username: 'danilostoletovic', category: 'Professional', icon: 'linkedin', identity: 'personal', primary: true, url: 'https://www.linkedin.com/in/danilostoletovic/', summary: 'Professional profile.', sources: [source('GitHub', github), previousPortfolio] },
  { id: 'upwork', title: 'Upwork', username: 'danilostoletovic', category: 'Professional', icon: 'briefcase', identity: 'personal', primary: true, url: 'https://www.upwork.com/freelancers/danilostoletovic', summary: 'Freelance profile.', sources: [previousPortfolio] },
  { id: 'fiverr', title: 'Fiverr Pro', username: 'stoletovicd', category: 'Professional', icon: 'briefcase', identity: 'personal', url: 'https://pro.fiverr.com/freelancers/stoletovicd', summary: 'Freelance profile.', sources: [previousPortfolio] },
  { id: 'youtube', title: 'YouTube', username: '@DaniloStoletovic', category: 'Social', icon: 'video', identity: 'personal', url: 'https://www.youtube.com/@DaniloStoletovic', summary: 'Public introduction.', sources: [previousPortfolio, source('Public introduction', 'https://www.youtube.com/shorts/g7EoOTN5HAM')] },
  { id: 'orcid', title: 'ORCID', username: person.orcid, category: 'Research', icon: 'research', identity: 'personal', url: orcidUrl(person.orcid), summary: 'Public researcher identifier.', sources: [source('GitHub', github), source('ORCID public record', `https://pub.orcid.org/v3.0/${person.orcid}/person`)] },
  { id: 'smartvehicle-lab', title: 'Smart Vehicle Lab', username: 'smartvehiclelab', category: 'Open source', icon: 'github', identity: 'project', url: lab, summary: 'Repositories for the SmartVehicle engineering project.', sources: [robotics, school] },
];

export const projects: readonly Project[] = [
  {
    id: 'smart-vehicle', title: 'SmartVehicle', category: 'Robotics', status: 'Prototype', includeInCv: true,
    summary: 'A Raspberry Pi vehicle with on-device object detection, live video, and a native Android control station.',
    stack: ['Raspberry Pi 5', 'Python', 'YOLO', 'Kotlin', 'Docker'],
    role: 'Built the vehicle software and the Android operator interface.',
    links: [source('Project website', robotics.url), roboticsCode, source('All repositories', lab)],
    image: { file: '/images/smart-vehicle.avif', alt: 'SmartVehicle prototype with blue enclosure and Mecanum wheels', width: 800, height: 1067 },
    sources: [robotics, roboticsCode, school],
  },
  {
    id: 'autodark', title: 'AutoDark', category: 'Apps', status: 'Released', includeInCv: true,
    summary: 'A Windows utility that switches between light and dark themes around local sunrise and sunset.',
    stack: ['C#', '.NET', 'Windows'],
    role: 'Developed the utility and prepared its Microsoft Store release.',
    links: [autoDarkStore, repository('AutoDark')],
    image: { file: '/images/autodark.avif', alt: 'AutoDark application artwork', width: 1254, height: 1254 },
    sources: [autoDarkStore, repository('AutoDark')],
  },
  {
    id: 'autobright', title: 'AutoBright', category: 'Apps', status: 'Released', includeInCv: true,
    summary: 'A Windows 11 utility that uses the camera to adjust laptop display brightness. Image processing runs on the device.',
    stack: ['C#', '.NET', 'WinForms', 'Windows'],
    role: 'Developed the application, camera processing, and Windows packaging.',
    links: [autoBrightStore, source('GitHub Releases', `${github}/AutoBright/releases`), repository('AutoBright')],
    sources: [autoBrightStore, repository('AutoBright')],
  },
  {
    id: 'class-timetable', title: 'Class Timetable', category: 'Apps', status: 'Released', includeInCv: true,
    summary: 'An open-source scheduling app for rotating school timetables, with local reminders and JSON backup.',
    stack: ['Flutter', 'Dart', 'Material 3'],
    role: 'Designed and developed the app and its cross-platform release workflows.',
    links: [source('Try the web app', 'https://danilostoletovic.github.io/class-timetable/'), repository('class-timetable'), source('GitHub Releases', `${github}/class-timetable/releases`)],
    image: { file: '/images/class-timetable.avif', alt: 'Class Timetable application interface', width: 960, height: 482 },
    sources: [repository('class-timetable')],
  },
  {
    id: 'cutwise', title: 'Cutwise', category: 'Web & AI', status: 'Alpha',
    summary: 'A local-first video editor with timeline edits and browser-side MP4 export.',
    stack: ['TypeScript', 'React', 'FFmpeg.wasm'],
    role: 'Developed the editor interface and export workflow.',
    links: [source('Browser preview', 'https://danilostoletovic.github.io/cutwise/'), repository('cutwise')],
    sources: [repository('cutwise')],
  },
  {
    id: 'secretary', title: 'Ana, AI Secretary', category: 'Web & AI', status: 'Open-source project', includeInCv: true,
    summary: 'A public portfolio assistant built around an approved knowledge base and a streaming Cloudflare Worker.',
    stack: ['TypeScript', 'Cloudflare Workers', 'Streaming'],
    role: 'Built the assistant, public knowledge integration, and conversation interface.',
    links: [source('Ask Ana', `${site}/commerce/#ana`), repository('secretary')],
    image: { file: '/images/ana.avif', alt: 'Ana AI secretary conversation interface', width: 1280, height: 720 },
    sources: [repository('secretary'), previousPortfolio],
  },
  {
    id: 'rustoy', title: 'Rustoy', category: 'Systems', status: 'Experiment',
    summary: 'A bootable USB and UEFI engineering project that explores native Rust tooling.',
    stack: ['Rust', 'UEFI', 'QEMU'],
    role: 'Developed the Rust host and boot components.',
    links: [repository('Rustoy')],
    sources: [repository('Rustoy')],
  },
  {
    id: 'promptui', title: 'PromptUI', category: 'Web & AI', status: 'Experiment',
    summary: 'An experimental workspace for AI responses that render as interface elements such as charts, forms, and tables.',
    stack: ['TypeScript', 'React', 'Bun', 'OpenUI'],
    role: 'Built the experimental workspace and gateway.',
    links: [source('Public demo', 'https://danilostoletovic.github.io/PromptUI/'), repository('PromptUI')],
    image: { file: '/images/promptui.avif', alt: 'PromptUI interface running in offline demo mode', width: 1100, height: 549 },
    sources: [repository('PromptUI'), portfolioNotes('promptui')],
  },
  {
    id: 'portfolio', title: 'Danilostoletovic.com', category: 'Web & AI', status: 'Open-source project',
    summary: 'A static-first professional site and public catalogue built with Astro.',
    stack: ['Astro', 'TypeScript', 'Cloudflare', 'MCP'],
    role: 'Site design, implementation, and content maintenance.',
    links: [source('Website', site), repository('danilostoletovic')],
    sources: [repository('danilostoletovic')],
  },
];

export const services: readonly Service[] = [
  { id: 'custom-software-development', title: 'Custom software', summary: 'Build a tool around a workflow, connect it to the services it needs, and prepare it for everyday use.', deliverables: ['Technical scoping', 'APIs and backend integration', 'Testing and handover'], sources: [previousPortfolio] },
  { id: 'business-websites', title: 'Websites & web applications', summary: 'Develop a site or web application with responsive layouts, accessible interfaces, and a maintainable deployment.', deliverables: ['Business sites and redesigns', 'Web applications', 'Performance and technical SEO'], sources: [previousPortfolio] },
  { id: 'mobile-app-development', title: 'Mobile & desktop applications', summary: 'Build Android, Flutter, and Windows applications from prototype to release preparation.', deliverables: ['Native Android and Flutter', 'Windows utilities', 'Distribution preparation'], sources: [previousPortfolio] },
  { id: 'ai-integrations', title: 'AI integrations & automation', summary: 'Integrate an assistant or automate a task using approved data and a defined workflow.', deliverables: ['Public-facing assistants', 'Existing-system integration', 'Failure handling'], sources: [previousPortfolio] },
  { id: 'technical-consulting', title: 'Technical consulting', summary: 'Investigate a technical problem, review the options, and agree on a useful next step.', deliverables: ['Architecture reviews', 'Troubleshooting', 'Implementation planning'], sources: [previousPortfolio] },
  { id: 'website-maintenance', title: 'Infrastructure & maintenance', summary: 'Deploy software, configure the services it depends on, and make the setup easier to operate.', deliverables: ['Linux, Docker, and Cloudflare', 'Hosting, DNS, and migrations', 'Maintenance and handover'], sources: [previousPortfolio] },
];

export const collaboration = [
  { title: 'Share the problem', summary: 'Describe what people need to do and where the current setup gets in the way.' },
  { title: 'Agree on scope', summary: 'Set the deliverables, timing, and cost before development.' },
  { title: 'Build and review', summary: 'Review working software at agreed points and address feedback.' },
  { title: 'Deploy and hand over', summary: 'Ship the work, document the setup, and agree on ongoing support if needed.' },
] as const;

export const cases: readonly CaseStudy[] = [
  {
    id: 'smart-vehicle', title: 'Keeping vision off the control path', project: 'smart-vehicle',
    summary: 'An edge vision system and Android control station for a Raspberry Pi vehicle.',
    problem: 'In the first prototype, a busy vision pipeline could delay the operator’s drive commands.',
    constraints: 'The vehicle had to run inference on the Pi, stream live video, and keep operating over a local connection when external Wi-Fi disappeared.',
    decisions: 'Camera capture, inference, and motor control have separate execution paths. A connectivity watchdog can provide a fallback hotspot.',
    implementation: 'Python services and Docker run on the Pi. The Kotlin client brings together the live view, drive controls, telemetry, and local OCR.',
    results: 'The prototype combined teleoperation and on-device detection and received a special award at the 2026 Galaksija Cup.',
    lessons: 'Keep expensive work outside the operator’s control path and design connection recovery into the system.',
    sources: [robotics, roboticsCode, award],
  },
  {
    id: 'secretary', title: 'Grounding a public AI assistant', project: 'secretary', relevantToClients: true,
    summary: 'An assistant that can answer questions about a portfolio without giving the website access to credentials.',
    problem: 'Visitors needed a way to ask about projects and services without digging through several pages.',
    constraints: 'Answers needed approved public context. The static website had to remain usable when the assistant was unavailable.',
    decisions: 'Keep the knowledge and model integration in a Cloudflare Worker. Separate request validation and rate controls from answer generation.',
    implementation: 'The browser sends a bounded conversation to the Worker, which supplies the public context and streams the model response.',
    results: 'The public repository documents browser integration, edge deployment, and an accessible conversation interface.',
    lessons: 'Keep the knowledge base reviewable and treat ordinary contact and navigation as independent paths.',
    sources: [repository('secretary'), previousPortfolio],
  },
  {
    id: 'class-timetable', title: 'Making rotating timetables predictable', project: 'class-timetable', relevantToClients: true,
    summary: 'A shared Flutter application for schedules that repeat across multiple weeks.',
    problem: 'A conventional weekly calendar becomes hard to use when classes rotate between weeks.',
    constraints: 'The schedule needed to support configurable cycles, work locally, and survive device changes.',
    decisions: 'Represent rotation as a cycle anchored to a reference date. Use a portable JSON format for backups.',
    implementation: 'The Flutter app derives the selected week, highlights the current class, and stores subjects, notes, and notification settings locally.',
    results: 'The public source includes Android, Windows, and browser build workflows and schedule import and export.',
    lessons: 'Keep the calendar rule explicit so the schedule can travel independently of the device.',
    sources: [repository('class-timetable')],
  },
  {
    id: 'promptui', title: 'Making generated interfaces inspectable', project: 'promptui',
    summary: 'A prototype for asking a model to return an interface and refining the result in conversation.',
    problem: 'Some AI responses are easier to use as forms, charts, or tables than as text.',
    constraints: 'The prototype had to show incoming output and recover from failed requests. The demonstration needed to run offline.',
    decisions: 'Separate the React workspace from the Bun gateway and make the offline demonstration explicit.',
    implementation: 'The workspace renders streamed OpenUI output and retains the thread for follow-up edits.',
    results: 'The prototype illustrates streamed UI generation and recovery in a local workspace.',
    lessons: 'Make partial and failed generations visible so a person can understand and retry them.',
    sources: [repository('PromptUI'), portfolioNotes('promptui')],
  },
  {
    id: 'portfolio', title: 'Publishing a portfolio from one content source', project: 'portfolio', relevantToClients: true,
    summary: 'A public catalogue that makes the same work available to readers and software clients.',
    problem: 'Project information, profile links, and contact details were spread across HTML, documentation, and assistant integrations.',
    constraints: 'The website needed to be static by default and use the established domain and Cloudflare hosting.',
    decisions: 'Use Astro to generate pages and downloadable representations from typed data. Run public MCP and chat on isolated routes.',
    implementation: 'Build-time validation checks relationships. JSON-LD, Markdown, CV, and MCP tools derive from the public catalogue.',
    results: 'The same content is available through the site, downloadable CV, and public data endpoints.',
    lessons: 'Use stable identifiers across formats and keep basic navigation and contact independent of auxiliary services.',
    sources: [repository('danilostoletovic')],
  },
];

export const publications: readonly Publication[] = [{
  id: 'smartvehicle-ieeestec-2026',
  title: 'SmartVehicle: Building and Controlling a Camera-Based Robotic Vehicle',
  summary: 'A conference paper on building and controlling the SmartVehicle camera-based robotic platform.',
  authors: [academicAuthor, { givenName: 'Dejan', familyName: 'Batanjac' }],
  date: '2026',
  venue: 'IEEESTEC – 19th Student Projects Conference',
  status: 'Published',
  doi: '10.46793/IEEESTEC19.427S',
  doiRegistration: 'pending',
  publicationType: 'Original scientific paper',
  proceedings: {
    isbn: '978-86-6125-301-0',
    firstPage: 427,
    location: 'Niš, Serbia',
    organizers: ['EESTEC LC Niš', 'IEEE Student Branch Niš', 'Faculty of Electronic Engineering Niš'],
    format: 'Print',
  },
  project: 'smart-vehicle',
  sources: [source('Conference proceedings archive', 'https://ieee.elfak.rs/en/conference-proceedings/')],
}];

export const achievements: readonly Achievement[] = [
  { id: 'galaksija-2026', title: 'Special award, 10th Galaksija Cup', organizer: 'Galaksija Cup', date: '2026-03-28', project: 'smart-vehicle', summary: 'The jury recognized Pametno vozilo Yolo with the award for a notable result.', sources: [award, school] },
  { id: 'make-it-day-2026', title: 'Second place, Make IT Day @ MET', organizer: 'Metropolitan University', date: '2026-05-29', summary: 'Second place in the AI assistant competition in Niš.', sources: [met] },
];

export const news: readonly NewsItem[] = ([
  { id: 'blic-makers-lab', title: 'SmartVehicle demonstration at the Niš Mejkers Lab opening', publisher: 'Blic', date: '2026-10-14', url: 'https://www.blic.rs/biznis/tech/elektrotehnicka-skola-nikola-tesla-u-nisu-dobila-mejkers-lab/j3jbeby', mention: 'Direct', project: 'smart-vehicle', summary: 'The report names Danilo and describes his demonstration of the vehicle at ETŠ Nikola Tesla.', sources: [school] },
  { id: 'met-results', title: 'Make IT Day @ MET 2026 results', publisher: 'Metropolitan University', date: '2026-06-05', url: met.url, mention: 'Direct', summary: 'The university names Danilo as runner-up in the Niš AI assistant competition.', sources: [met] },
  { id: 'zetss-results', title: 'Recognition at the 10th Galaksija Cup', publisher: 'Association of Electrical Engineering Schools of Serbia', date: '2026-04-07', url: 'https://www.zetss.edu.rs/2026/04/07/odrzan-jubilarni-deseti-po-redu-galaksija-kup/', mention: 'Direct', project: 'smart-vehicle', summary: 'The association records the special award for Pametno vozilo Yolo.', sources: [award] },
  { id: 'galaksija-results', title: 'Galaksija Cup winners and special awards', publisher: 'Galaksija Cup', date: '2026-04-01', url: award.url, mention: 'Direct', project: 'smart-vehicle', summary: 'The organizer lists the vehicle among the projects receiving special recognition.', sources: [award] },
  { id: 'blic-galaksija', title: 'Projects recognized at the 10th Galaksija Cup', publisher: 'Blic', date: '2026-04-02', url: 'https://www.blic.rs/biznis/tech/ovo-dva-tehnoloske-resenja-su-odnela-pobedu-na-10-galaksija-kupu-2026/6vt13wc', mention: 'Direct', project: 'smart-vehicle', summary: 'National coverage includes the vehicle and its special award.', sources: [award] },
  { id: 'niskaprica-galaksija', title: 'Niš students recognized at Galaksija Cup', publisher: 'Niška Priča', date: '2026-03-30', url: 'https://niskaprica.rs/drustvo/niski-tesla-sa-kolegama-medju-najboljima-u-srbiji/', mention: 'Direct', project: 'smart-vehicle', summary: 'Local reporting names Danilo and the vehicle’s special award.', sources: [award] },
  { id: 'pcpress-galaksija', title: 'Galaksija Cup 2026 results', publisher: 'PC Press', date: '2026-04-03', url: 'https://pcpress.rs/pobednici-galaksija-kupa-2026-logopedski-uredaj-iz-novog-sada-najbolji-nagradeni-i-podvodni-dron-iz-nisa-i-pametna-invalidska-kolica-iz-cacka/', mention: 'Direct', project: 'smart-vehicle', summary: 'Technology coverage includes the special-award results.', sources: [award] },
  { id: 'telegraf-galaksija', title: 'Galaksija Cup winners and recognized projects', publisher: 'Nauka Telegraf', date: '2026-04-02', url: 'https://nauka.telegraf.rs/naucne-zanimljivosti/4300950-pobednici-galaksija-kupa-2026-logopedski-uredjaj-iz-novog-sada-najbolji', mention: 'Direct', project: 'smart-vehicle', summary: 'Science coverage includes Danilo and Pametno vozilo Yolo.', sources: [award] },
  { id: 'politika-galaksija', title: 'Student engineering solutions for everyday problems', publisher: 'Politika', date: '2026-04', url: 'https://www.politika.rs/sr/clanak/744944/inovativna-ucenicka-resenja-svakodnevnih-problema', mention: 'Direct', project: 'smart-vehicle', summary: 'The coverage includes SmartVehicle in the competition’s special-award results.', sources: [award] },
] satisfies NewsItem[]).sort((first, second) => second.date.localeCompare(first.date));
