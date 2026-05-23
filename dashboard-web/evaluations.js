// evaluations.js - Full evaluation data with A-G framework
const EVALUATIONS = {
  cohere: {
    rank: 1,
    company: "Cohere",
    role: "Forward Deployed Engineer, Agentic Platform",
    score: 4.5,
    scoreLabel: "CANADIAN DREAM ROLE",
    comp: "$150K–$220K CAD",
    location: "Toronto/Remote",
    verdict: "APPLY NOW",
    url: "https://jobs.ashbyhq.com/cohere",
    archetype: "Forward Deployed Engineer (FDE) — Customer-facing technical consultant",
    blockA: {
      level: "Senior IC",
      salary: "CA$150K–$220K base + equity",
      location: "Toronto/Remote (Canada eligible!)",
      reportsTo: "Solutions/Eng Lead",
      stack: "Backend, Infrastructure, Agent Dev, Deployments"
    },
    blockB: {
      matches: [
        "10+ years React/Next.js/TypeScript → Full-Stack (React + Python)",
        "Agentic AI integration specialist → 'Develop autonomous agents'",
        "AI-assisted development expert → 'Productionize state-of-the-art models'",
        "Game dev (Disney, Radical) → 'Fast-paced, execute while priorities move'"
      ],
      gaps: ["Python depth — role needs Python for backend/agent systems"]
    },
    blockC: {
      targetLevel: "Senior (not Staff)",
      strategy: "Apply as Senior; emphasize 20 years + agentic AI expertise"
    },
    blockD: {
      notes: "Cohere median SWE Toronto: CA$211K. Staff level pushes CA$250K+. 6 weeks vacation!"
    },
    blockE: {
      hooks: [
        "Lead with agentic portfolio — OpenClaw voice plugin, swim club OS",
        "Emphasize customer-facing work — consulting projects, client deliverables",
        "Position as 'deployment expert' — shipping to production, not just prototypes"
      ]
    },
    blockF: {
      stories: [
        "Agentic System Architecture — Built voice-controlled AI assistant end-to-end",
        "Scaling/Performance — Swimming club platform with <100ms page loads",
        "Fast-Paced Environment — Game dev at Disney/Radical with shifting priorities",
        "Customer-Facing Technical Work — Consulting projects with diverse clients"
      ]
    },
    blockG: {
      legitimacy: "Legit — $6.8-7B valuation, $1.71B total funding, Series D"
    }
  },
  
  langchain: {
    rank: 2,
    company: "LangChain",
    role: "Deployed Engineer (Toronto)",
    score: 4.5,
    scoreLabel: "CANADA-ELIGIBLE DREAM ROLE",
    comp: "$205K–$342K CAD",
    location: "Toronto/Remote",
    verdict: "APPLY NOW",
    url: "https://jobs.ashbyhq.com/langchain",
    archetype: "Customer-Facing Technical IC — Co-architect AI agents WITH customer engineering teams",
    blockA: {
      level: "L3-L4 (Senior Deployed Engineer)",
      salary: "$150K–$270K USD base ($205K–$370K CAD)",
      location: "Toronto, Remote (Canada eligible!)",
      travel: "Moderate (customer-facing)",
      focus: "Custom AI solutions, API dev, enterprise integrations"
    },
    blockB: {
      matches: [
        "3+ years technical role — 20 years engineering",
        "Startup/scale-up experience — Game dev, early-stage startups",
        "Strong Python, JavaScript — React, Next.js, TypeScript + Python",
        "Designed agent-based/LLM applications — Agentic AI specialist",
        "Comfortable with customers during POCs — Client-facing consulting",
        "NICE: Deployed AI agents using LangChain/LangGraph — Explicitly mentioned"
      ],
      gaps: ["Cloud, containers, K8s — need to highlight infrastructure exposure"]
    },
    blockC: {
      targetLevel: "L3-L4 (Senior Deployed Engineer)",
      strategy: "Apply as Senior; emphasize 20 years + agentic AI expertise; 'founding member' angle"
    },
    blockD: {
      notes: "LangChain SWE median: $155K–$177K. Deployed Eng Central: $150K–$270K. Even low end ($150K USD = $205K CAD) meets your target."
    },
    blockE: {
      hooks: [
        "Resume headline: 'Forward Deployed Engineer — Agentic AI Specialist'",
        "Cover letter: 'I've spent the past X years actually building with AI agents'",
        "Lead with projects: OpenClaw voice plugin, multi-step workflows, LangSmith familiarity"
      ]
    },
    blockF: {
      stories: [
        "Helped team adopt new technology — Led migration to AI-powered features with LangChain",
        "Complex system architecture — Scalable frontend with performance optimization",
        "Technical disagreements with customers — Guided customer to better architecture with data",
        "Design agent system — Multi-agent vs single, state management, failure handling"
      ]
    },
    blockG: {
      legitimacy: "Legit — langchain.com, 90M+ monthly OSS downloads, Sequoia-backed, 83 open roles"
    }
  },

  databricks: {
    rank: 3,
    company: "Databricks",
    role: "Senior Software Engineer (Fullstack)",
    score: 4,
    scoreLabel: "STRONG CANADIAN OPPORTUNITY",
    comp: "$252K+ CAD",
    location: "Vancouver/Remote",
    verdict: "APPLY",
    url: "https://jobs.databricks.com",
    archetype: "Platform/Infrastructure Engineer — Building core runtime services, distributed systems",
    blockA: {
      level: "L5 Senior Software Engineer",
      salary: "CA$252K total (CA$135K base + CA$107K equity + CA$9.4K bonus)",
      location: "Vancouver, BC (confirmed active posting) + remote flexibility",
      stack: "React, TypeScript, Scala/Java backend, Spark ecosystem"
    },
    blockB: {
      matches: [
        "20 years engineering — Deep experience valued",
        "Senior Full Stack (React/Next.js/TS) — Exact match for Fullstack SE role",
        "Agentic AI integration specialist — Databricks betting big on AI/ML",
        "Vancouver BC local — No relocation needed"
      ],
      gaps: [
        "Spark/Delta Lake experience — may need to demonstrate familiarity",
        "Scala/Java backend — less experience here; emphasize willingness to learn"
      ]
    },
    blockC: {
      targetLevel: "L5 Senior Software Engineer",
      strategy: "Apply as L5; emphasize 10+ years senior fullstack + game dev seniority; 'agentic AI specialization' as differentiator"
    },
    blockD: {
      notes: "Databricks L5: CA$252K total. L4 would still likely hit your target. RSU vesting: 40% Y1, 30% Y2, 20% Y3, 10% Y4."
    },
    blockE: {
      hooks: [
        "Resume: 'Senior Full Stack Engineer with 20 years of experience building scalable, interactive systems'",
        "Emphasize: 'Hands-on experience integrating LLM agents into production workflows'",
        "Game dev angle: 'Shipped AAA titles under deadline pressure; brings nail it then scale it execution mindset'"
      ]
    },
    blockF: {
      stories: [
        "Agentic AI Integration — Led technical architecture for safe, reliable AI agent integration",
        "Fullstack Scale — Optimized React application for enterprise-scale data visualization (60% improvement)",
        "Cross-Functional Delivery — Delivered core systems while managing creative + technical requirements at Disney",
        "System Design — Design for collaborative editing (like Databricks notebooks)"
      ]
    },
    blockG: {
      legitimacy: "Legit — $43B valuation, 5,000+ employees, well-documented, rigorous interview process"
    }
  },

  n8n: {
    rank: 4,
    company: "n8n",
    role: "Sr AI Engineer / Staff LLM Engineer",
    score: 4.5,
    scoreLabel: "DREAM ROLE (location blocker)",
    comp: "$220K–$280K CAD",
    location: "Europe only",
    verdict: "Dream role, blocked by geography",
    url: "https://n8n.io/careers",
    archetype: "AI Engineer — Agentic AI, workflow automation, TypeScript",
    blockA: {
      level: "Senior/Staff",
      salary: "$160K–$205K USD = $220K–$280K CAD",
      location: "Remote — Europe OR Berlin Office (Germany)",
      stack: "TypeScript, Vue.js, Node.js"
    },
    blockB: {
      matches: [
        "95% role fit — agentic AI, TypeScript, workflow automation",
        "10+ years React/Next.js/TypeScript — your wheelhouse",
        "20 years engineering experience — exceeds requirements"
      ],
      gaps: ["Location: Europe only — blocker for Vancouver-based role"]
    },
    blockC: {
      targetLevel: "Staff LLM Engineer — perfect for your experience",
      strategy: "Would apply if location flexible; highlight AI integration + TypeScript depth"
    },
    blockD: {
      notes: "Comp at your target. 650K+ users, well-funded ($2.5B), open-source culture."
    },
    blockE: {
      hooks: ["Would emphasize: 'Agentic AI integration specialist with production TypeScript experience'"],
      blocker: "Location: Europe only — no Canada/remote flexibility stated"
    },
    blockF: {
      stories: ["Would use: AI integration stories, TypeScript architecture, workflow automation examples"]
    },
    blockG: {
      legitimacy: "Legit — $2.5B valuation, well-funded, 650K+ users"
    }
  },

  elevenlabs: {
    rank: 5,
    company: "ElevenLabs",
    role: "Forward Deployed Engineer",
    score: 4,
    scoreLabel: "STRONG MATCH, CANADA ELIGIBLE",
    comp: "$235K–$255K CAD",
    location: "Remote global",
    verdict: "APPLY",
    url: "https://elevenlabs.io/careers",
    archetype: "Forward Deployed Engineer — Voice AI, customer-facing technical",
    blockA: {
      level: "Forward Deployed Engineer / Enterprise Solutions Engineer",
      salary: "$170K–$185K USD = $235K–$255K CAD",
      location: "Remote global — Canada explicitly eligible!",
      culture: "No titles, fully remote, core hours GMT+3 to GMT-5 (fits PST)"
    },
    blockB: {
      matches: [
        "Comp exceeds target — $235K–$255K CAD",
        "Location — Remote global, Canada eligible",
        "AI Focus — Voice AI agents, RoboDevil experience relevant",
        "Culture — No titles, fully remote"
      ],
      gaps: [
        "Python — primary stack, need to refresh",
        "Voice/Telephony domain — have voice AI experience but not telephony-specific (SIP/WebRTC)"
      ]
    },
    blockC: {
      targetLevel: "Forward Deployed Engineer",
      strategy: "Apply; emphasize voice AI experience + Canadian eligibility"
    },
    blockD: {
      notes: "Exceeds your $150K–$200K CAD target. $3B valuation, voice AI leader."
    },
    blockE: {
      hooks: [
        "Emphasize RoboDevil voice assistant experience",
        "Highlight Canadian eligibility upfront",
        "Refresh Python skills before interviews"
      ]
    },
    blockF: {
      stories: [
        "Voice AI Integration — Built OpenClaw voice plugin with wake word, Whisper, TTS",
        "Customer-Facing Technical Work — Consulting/freelance with diverse clients"
      ]
    },
    blockG: {
      legitimacy: "Legit — $3B valuation, voice AI leader, rapid growth"
    }
  },

  vapi: {
    rank: 6,
    company: "Vapi",
    role: "MTS Forward Deployed",
    score: 4,
    scoreLabel: "EXCELLENT (location challenge)",
    comp: "$275K–$385K CAD",
    location: "SF/NYC hybrid",
    verdict: "APPLY with Canadian founder leverage",
    url: "https://jobs.ashbyhq.com/vapi",
    archetype: "Member of Technical Staff, Forward Deployed — High-growth YC startup",
    blockA: {
      level: "Senior IC (L5-L6 equivalent)",
      salary: "$200K–$280K USD = $275K–$385K CAD",
      location: "SF/NYC (hybrid - 25% office)",
      culture: "70% previous founders, ownership mentality"
    },
    blockB: {
      matches: [
        "20 years engineering — Strong builder credibility",
        "Agentic AI integration — LLM deployment, agent dev",
        "React/Next.js/TypeScript — 'Ideally TypeScript' explicitly mentioned",
        "AI-assisted development — Hands-on Claude experience"
      ],
      gaps: [
        "Location: SF/NYC hybrid — need to negotiate or relocate",
        "Customer-facing experience — 3+ years required, frame consulting background"
      ]
    },
    blockC: {
      targetLevel: "Senior (mid-upper range of $200K–$300K)",
      strategy: "Apply; lead with technical credibility + 'Canadian founder connection' as leverage for flexibility"
    },
    blockD: {
      notes: "2× your target! Even low end ($200K USD = $275K CAD) significantly exceeds."
    },
    blockE: {
      hooks: [
        "Canadian connection: Founders Jordan/Nikhil are Canadian!",
        "Lead with: 'I built a production voice assistant on your platform. Now I want to help enterprises do the same.'",
        "Emphasize: '20 years shipping, 2 years shipping AI — ready to scale both'"
      ]
    },
    blockF: {
      stories: [
        "LLM/Agent deployment — OpenClaw voice plugin with Claude integration",
        "Customer collaboration — Disney/Radical cross-functional work",
        "Handling ambiguity — Indie game development with limited resources"
      ]
    },
    blockG: {
      legitimacy: "Legit — YC W23, $25.2M Series A, Bessemer, 600k+ developers"
    }
  },

  anthropic: {
    rank: 7,
    company: "Anthropic",
    role: "FDE Applied AI",
    score: 4,
    scoreLabel: "TOP-TIER (location/comp tradeoffs)",
    comp: "$275K–$410K CAD",
    location: "SF/NYC/London",
    verdict: "APPLY with visa strategy",
    url: "https://jobs.anthropic.com",
    archetype: "Forward Deployed Engineer, Applied AI — Build-with-Customer",
    blockA: {
      level: "Senior IC",
      salary: "$200K–$300K USD = $275K–$410K CAD",
      location: "SF, NYC, Seattle (hybrid - 25% office)",
      travel: "~25% to customer sites"
    },
    blockB: {
      matches: [
        "20 years engineering — Strong builder credibility",
        "Agentic AI specialist — LLM deployment, agent dev",
        "React/Next.js/TypeScript — 'Ideally TypeScript' mentioned",
        "AI-assisted development — Hands-on Claude experience, prompt engineering"
      ],
      gaps: [
        "Python proficiency — required, can upskill",
        "Customer-facing experience — 3+ years required, frame consulting background",
        "Location — SF/NYC/London require relocation or visa"
      ]
    },
    blockC: {
      targetLevel: "Senior (mid-upper range of $200K–$300K)",
      strategy: "Apply to FDE role; lead with technical credibility + Claude expertise; visa sponsorship available"
    },
    blockD: {
      notes: "Significantly exceeds target (30-100% above). SWE median: $570K–$582K USD."
    },
    blockE: {
      hooks: [
        "Resume headline: 'Senior Full-Stack Engineer | Agentic AI Specialist | 20 Years Production Experience'",
        "First bullet: 'Deep expertise in Claude and agentic AI systems — daily power user'",
        "Cover letter: 'From building games at Disney to architecting AI systems — bringing builder mindset to help enterprises deploy Claude'"
      ]
    },
    blockF: {
      stories: [
        "LLM/Agent deployment — Built OpenClaw voice plugin with Claude integration",
        "Customer collaboration — Disney/Radical cross-functional work",
        "Handling ambiguity — Indie game development",
        "Technical architecture — Scalable frontend systems",
        "AI safety/responsibility — Human-in-the-loop design"
      ]
    },
    blockG: {
      legitimacy: "Legit — job-boards.greenhouse.io (official ATS), anthropic.com/careers, salary transparency"
    }
  },

  scaleai: {
    rank: 8,
    company: "Scale AI",
    role: "Forward Deployed Engineer",
    score: 4,
    scoreLabel: "HIGH-INTENSITY, HIGH-REWARD",
    comp: "$206K–$302K CAD",
    location: "SF/NYC",
    verdict: "APPLY if open to intensity",
    url: "https://scale.com/careers",
    archetype: "Forward Deployed Engineer — High-growth AI infrastructure, Palantir-like intensity",
    blockA: {
      level: "Mid-level (3+ years)",
      salary: "$153K–$224K USD base = $206K–$302K CAD",
      location: "SF/NYC (on-site preferred, 'strong preference' for onsite customer work)",
      culture: "'Move fast, find the 20%, write the market' — high ownership, high pressure"
    },
    blockB: {
      matches: [
        "React, Next.js, TypeScript, Node, Python — Perfect stack match",
        "20 years engineering — Exceeds 3+ year minimum significantly",
        "AI/LLM experience — Agentic AI specialist, directly relevant to GenAI focus",
        "Fast-paced, ambiguous — Game dev background (Disney, Radical)"
      ],
      gaps: [
        "Customer-facing — Deeply client-facing (onsite, exec meetings) — pivot from pure IC",
        "Location — Vancouver vs SF/NYC, relocation or remote negotiation needed"
      ]
    },
    blockC: {
      targetLevel: "Senior Forward Deployed Engineer",
      strategy: "Apply; lead with AI expertise as differentiator; frame game dev stakeholder management as 'client experience'"
    },
    blockD: {
      notes: "Exceeds your compensation target even at base. L4–L5 FDE estimated $250K–$400K USD with equity."
    },
    blockE: {
      hooks: [
        "Resume angle: 'Senior Full-Stack Engineer | Agentic AI Specialist | 20 Years Building Scalable Systems'",
        "Highlight: AI-assisted development experience — directly relevant to Scale's product",
        "Address gap: Frame Disney/Radical stakeholder management as 'client collaboration'"
      ]
    },
    blockF: {
      stories: [
        "Technical Challenge + Customer Impact — Debugged across React, Node, Python AI services; reduced iteration time 40%",
        "Working with Ambiguity — Game dev requirements constantly shifting; built flexible architectures",
        "AI/LLM Experience — Built systems using modern AI architectures, prompt engineering, tool-use patterns",
        "Stakeholder Management — Disney game projects required approval from multiple IP stakeholders"
      ]
    },
    blockG: {
      legitimacy: "Legit — $7B+ valuation, unicorn, major player, powers OpenAI/Meta/Microsoft"
    }
  },

  runpod: {
    rank: 9,
    company: "RunPod",
    role: "FDE / Full-Stack",
    score: 4,
    scoreLabel: "STRONG TECH/COMP MATCH (verify Canada)",
    comp: "$245K–$270K CAD",
    location: "Remote USA",
    verdict: "Verify Canada eligibility first",
    url: "https://runpod.io/careers",
    archetype: "Forward Deployed Engineer / Full-Stack — GPU cloud for AI/ML",
    blockA: {
      level: "Senior/Staff Full-Stack or Forward Deployed Engineer",
      salary: "$180K–$200K USD = $245K–$270K CAD",
      location: "Remote, USA (check Canada eligibility)",
      stack: "Python, TypeScript, Go, React, FastAPI, Kubernetes"
    },
    blockB: {
      matches: [
        "Python/TypeScript — Daily driver languages",
        "React/Next.js — 10+ years production experience",
        "Full-stack architecture — Senior-level expertise",
        "AI/ML integration — 'Agentic AI integration specialist'",
        "Cloud platforms — AWS/Vercel experience"
      ],
      gaps: [
        "Go Lang — Some exposure, willing to learn",
        "Kubernetes depth — Joel's strength is frontend; role needs backend/DevOps heavy"
      ]
    },
    blockC: {
      targetLevel: "Senior Full-Stack or Senior FDE",
      strategy: "LinkedIn outreach FIRST — verify Canada remote eligibility before applying"
    },
    blockD: {
      notes: "Even mid-level Full-Stack range ($180K–$200K USD) translates to $245K–$270K CAD — significantly above target."
    },
    blockE: {
      hooks: [
        "Game Dev → AI Infra Parallel: '20 years optimizing performance under constraints — from console games to GPU clusters'",
        "Agentic AI Specialization: Direct relevance to RunPod's AI/ML customer base",
        "Full-Stack Architecture: SDK development experience aligns with their open-source SDK work"
      ]
    },
    blockF: {
      stories: [
        "AI Integration at Scale — Built TypeScript orchestration layer for conversational AI",
        "Production Debug Under Pressure — Game launch day critical memory leak fix",
        "Cross-System Integration — Built Node.js middleware, standardized error handling, containerized with Docker"
      ]
    },
    blockG: {
      legitimacy: "Legit — $22M total ($20M Seed led by Intel Capital + Dell), $120M ARR, 90% YoY growth"
    }
  },

  arizeai: {
    rank: 10,
    company: "Arize AI",
    role: "AI Product Engineer",
    score: 3.5,
    scoreLabel: "GOOD FIT (visa/location blockers)",
    comp: "$210K–$250K CAD",
    location: "Remote US",
    verdict: "APPLY with TN visa strategy",
    url: "https://arize.com/careers",
    archetype: "AI Product Engineer / Solutions Engineer — AI observability/LLM monitoring",
    blockA: {
      level: "Senior IC (L5-L6 equivalent)",
      salary: "$155K–$185K USD = $210K–$250K CAD",
      location: "Remote (United States) — need TN visa or sponsorship",
      stack: "React, TypeScript, Python, AI/ML platform"
    },
    blockB: {
      matches: [
        "10+ years React, Next.js, TypeScript — Full-Stack role perfect match",
        "Python/Go — Python via OpenClaw, skills dev",
        "AI/LLM ecosystem interest — Building AI assistant",
        "SaaS platforms at scale — Disney, Radical, enterprise work"
      ],
      gaps: [
        "No explicit 'AI Product' title — needs to frame OpenClaw as AI product work",
        "No GraphQL — minor, learnable",
        "No ML/data viz product experience — addressable via project work"
      ]
    },
    blockC: {
      targetLevel: "Senior IC (L5-L6)",
      strategy: "Apply with TN visa strategy; $165K–$185K USD base realistic; mention TN visa eligibility in cover letter"
    },
    blockD: {
      notes: "Base may fall within your target range. Series C, $135M raised, 4.7/5 Glassdoor."
    },
    blockE: {
      hooks: [
        "Resume headline: 'Forward Deployed Engineer — Agentic AI Specialist'",
        "Cover letter: 'Built production AI systems before AI Engineer was a title'",
        "Emphasize: 'Game dev background = pixel-perfect UX instincts for developer tools'"
      ]
    },
    blockF: {
      stories: [
        "AI Integration at Scale — Customer needed conversational AI integrated into React app",
        "Scaling/Performance — Swimming club platform optimization",
        "Fast-Paced Environment — Game dev milestones with shifting priorities",
        "Customer-Facing Technical Work — Consulting projects with diverse clients"
      ]
    },
    blockG: {
      legitimacy: "Legit — Series C, $135M+ raised, 150+ enterprise customers, 8K+ LinkedIn followers"
    }
  },

  notion: {
    rank: 11,
    company: "Notion",
    role: "FDE Developer Platform",
    score: 3.5,
    scoreLabel: "EXCELLENT FIT (location blocker)",
    comp: "$292K–$440K CAD",
    location: "SF/NYC",
    verdict: "Perfect fit, blocked by location",
    url: "https://jobs.notion.com",
    archetype: "Forward Deployed Software Engineer, Developer Platform — Solution Architect + AI Specialist",
    blockA: {
      level: "L3-L4 equivalent (Staff/Senior FDE)",
      salary: "$213K–$320K USD base = $292K–$440K CAD",
      location: "SF/NY (Hybrid — 3 days in office)",
      focus: "Custom AI solutions, API dev, enterprise integrations"
    },
    blockB: {
      matches: [
        "Customer-facing skills — AI consulting work, team leadership",
        "Engineering fundamentals — 20 years, React/Next.js/TypeScript, game dev at Disney/Radical",
        "AI tooling & automation — 'Agentic AI integration specialist'",
        "Systems thinking — Frontend architecture, scalable systems",
        "High agency/ambiguity — Indie game dev, startup experience"
      ],
      gaps: [
        "4-8 years exp — Overqualified (20 years), frame as 'value-add'",
        "Notion familiarity — Build public Notion workspace to demonstrate"
      ]
    },
    blockC: {
      targetLevel: "L3-L4 (Staff/Senior FDE)",
      strategy: "Position as 'senior IC who can mentor founding team'; express interest in IC work, hands-on coding"
    },
    blockD: {
      notes: "Even low end ($213K USD = $292K CAD) exceeds your target. L5 total comp can reach $735K."
    },
    blockE: {
      hooks: [
        "Build a Notion Portfolio — Create public workspace with AI agent examples, system architecture docs",
        "LinkedIn Optimization — 'Forward Deployed Engineer | AI Integration Specialist | 20 Years Building Scalable Systems'",
        "Cover letter: 'I've spent 20 years shipping software — from AAA games to modern fullstack platforms'"
      ]
    },
    blockF: {
      stories: [
        "Customer-Facing Technical Discovery — Consulting client needed AI integration; 40% productivity improvement",
        "AI/Automation Implementation — Built OpenClaw framework with voice control; 30%+ personal productivity gains",
        "Systems Thinking & Architecture — Modular component system supporting 3 shipped titles",
        "High Agency / Ambiguity — New AI tooling space; became team's go-to AI expert"
      ]
    },
    blockG: {
      legitimacy: "Legit — $10B+ valuation, well-known, customers include OpenAI, Figma, Toyota"
    }
  },

  parloa: {
    rank: 12,
    company: "Parloa",
    role: "Senior FDE",
    score: 3.5,
    scoreLabel: "EXCELLENT ROLE, LOCATION BLOCKER",
    comp: "$135K–$180K CAD",
    location: "Germany only",
    verdict: "Strong role, EU block",
    url: "https://parloa.com/careers",
    archetype: "Forward Deployed Engineer — German voice AI company, Europe-focused",
    blockA: {
      level: "Senior (L5-L6 equivalent)",
      salary: "€90K–130K base = ~$135K–$180K CAD",
      location: "Berlin/Munich/Remote Germany ONLY",
      stack: "TypeScript, Node.js, OpenAI, Azure, Kubernetes"
    },
    blockB: {
      matches: [
        "20 years engineering exp — Exceeds 7+ years required",
        "10+ years React/TypeScript — Direct match",
        "Agentic AI integration — Core requirement",
        "Disney/Radical game dev — Transferable to enterprise scale"
      ],
      gaps: [
        "Location: Germany only — BLOCKER for Vancouver-based role",
        "DevOps/Kubernetes depth — Medium gap; Joel's strength is frontend"
      ]
    },
    blockC: {
      targetLevel: "Senior (appropriate)",
      strategy: "Could target Staff given 20 years, but first FDE role at new company → Senior is appropriate entry point"
    },
    blockD: {
      notes: "Base may fall below your $150K–$200K CAD target, but equity upside at $3B valuation could compensate."
    },
    blockE: {
      hooks: [
        "Cover letter: 'I specialize in building and deploying agentic AI systems that bridge frontier models with enterprise outcomes'",
        "Resume: Lead with agentic AI work, add 'Customer-Facing' bullet, include MCP in tech stack"
      ]
    },
    blockF: {
      stories: [
        "AI Integration at Scale — Built TypeScript orchestration layer with streaming responses",
        "Production Debug Under Pressure — Game launch day memory leak fix; zero downtime",
        "Cross-System Integration — Node.js middleware, containerized with Docker",
        "Mentoring/Owning Outcomes — Junior team struggling with state management; 30% velocity increase"
      ]
    },
    blockG: {
      legitimacy: "Legit — $3B valuation, $560M+ total funding, Series D, tier-1 investors"
    }
  },

  boomi: {
    rank: 13,
    company: "Boomi",
    role: "Senior Software Engineer",
    score: 3.5,
    scoreLabel: "SOLID CANADIAN OPPORTUNITY",
    comp: "$129K–$162K CAD",
    location: "Vancouver",
    verdict: "Infrastructure pivot",
    url: "https://boomi.com/careers",
    archetype: "Platform/Infrastructure Engineer — Java-heavy backend, runtime services",
    blockA: {
      level: "Senior Software Engineer",
      salary: "$129,388–$161,735 CAD + bonus",
      location: "Vancouver — Remote",
      stack: "Java, Kubernetes, distributed systems"
    },
    blockB: {
      matches: [
        "20 years engineering — Signals seniority",
        "Game dev — Proves shipping under pressure",
        "Senior Full Stack — End-to-end shipping ability",
        "Vancouver BC — Perfect location match"
      ],
      gaps: [
        "Tech Stack — Java-heavy, not your primary (React/TypeScript)",
        "Domain — Integration platform/runtime services, not AI-focused",
        "Kubernetes — Required, need to demonstrate hands-on K8s"
      ]
    },
    blockC: {
      targetLevel: "Senior",
      strategy: "Apply if open to infrastructure/platform engineering; this is a pivot away from AI/frontend toward backend infrastructure"
    },
    blockD: {
      notes: "Within your target range. Established iPaaS (Dell/Francisco Partners), not startup risk."
    },
    blockE: {
      hooks: [
        "Emphasize: '20 years shipping discipline to the lakehouse platform'",
        "Address: Show backend/DevOps exposure, willingness to learn Java/Scala"
      ]
    },
    blockF: {
      stories: [
        "Distributed Systems — Game state management across multiple platforms",
        "Performance Optimization — AAA title optimization under constraints",
        "Shipping Under Pressure — Disney/Radical deadline culture"
      ]
    },
    blockG: {
      legitimacy: "Legit — Established iPaaS, Dell/Francisco Partners acquisition"
    }
  },

  cognition: {
    rank: 14,
    company: "Cognition",
    role: "FDE / AI Engineer",
    score: 3,
    scoreLabel: "HIGH-PROFILE BUT EXTREME CULTURE",
    comp: "$150K+ USD",
    location: "SF only",
    verdict: "80hr/week culture",
    url: "https://cognition.ai/careers",
    archetype: "AI Engineer / Forward Deployed Engineer — Devin AI coding company",
    blockA: {
      level: "Senior Engineer",
      salary: "$150K+ USD base",
      location: "San Francisco, CA (on-site required)",
      culture: "EXTREME — 80-hour weeks, 6-day office, documented 'extreme performance culture'"
    },
    blockB: {
      matches: [
        "Agentic AI integration — HIGHLY RELEVANT — literally what Cognition does (Devin)",
        "AI-assisted development — HIGHLY RELEVANT — core to their product",
        "Senior Full Stack — FDE role values end-to-end shipping",
        "Game dev — Proves can ship under pressure"
      ],
      gaps: [
        "No explicit ML/AI research background — for AI Engineer role",
        "No Python/LLM training experience listed",
        "Location — Vancouver vs SF",
        "CULTURE FIT — EXTREME mismatch with your work-life balance preferences"
      ]
    },
    blockC: {
      targetLevel: "Senior",
      strategy: "Apply to FDE role (not AI Engineer); in initial screens, directly ask about work-life expectations; DECLINE if they confirm 80hr/6-day culture"
    },
    blockD: {
      notes: "Pays above your target range. But 80-hour weeks = effectively $95K/year at standard 40hr equivalent. Culture tax is steep."
    },
    blockE: {
      hooks: [
        "The Agentic AI Practitioner: 'I've spent the last X years actually building with AI agents'",
        "The Shipper: '20 years shipping products at Disney and Radical'",
        "The Translator: 'Forward Deployed Engineers need to speak customer and code fluently'"
      ]
    },
    blockF: {
      stories: [
        "Agentic AI Integration — Built production-grade agent workflow",
        "Full-Stack Under Pressure — Tight deadline at Disney/Radical",
        "Customer/Stakeholder Management — Misaligned expectations on technical project"
      ]
    },
    blockG: {
      legitimacy: "Legit BUT HIGH RISK — Devin AI well-known, $2B+ valuation, but extreme culture is documented and non-negotiable"
    }
  },

  zapier: {
    rank: 15,
    company: "Zapier",
    role: "Pre-Sales Solutions Architect",
    score: 3,
    scoreLabel: "GOOD COMP, CAREER PIVOT",
    comp: "$305K–$457K CAD",
    location: "NAMER",
    verdict: "Not hands-on IC engineering",
    url: "https://zapier.com/careers",
    archetype: "Pre-Sales Solutions Architect — Career pivot to technical sales hybrid",
    blockA: {
      level: "Pre-Sales Solutions Architect",
      salary: "$220K–$330K USD = $305K–$457K CAD",
      location: "NAMER remote — Canada eligible",
      type: "Pre-Sales = career pivot (not hands-on IC engineering)"
    },
    blockB: {
      matches: [
        "Compensation — Exceeds target significantly",
        "Location — NAMER remote, Canada eligible",
        "Company — Zapier, profitable, established, remote-first"
      ],
      gaps: [
        "Role type — Pre-Sales = career pivot, not hands-on IC engineering",
        "Requirements — 8+ years pre-sales experience — you don't have this",
        "Close rates, quota — You don't have enterprise SaaS sales background"
      ]
    },
    blockC: {
      targetLevel: "Pre-Sales Solutions Architect",
      strategy: "Career pivot; would need to frame engineering + consulting background as transferable; significant stretch"
    },
    blockD: {
      notes: "Exceeds target, but role is a major pivot from your current trajectory."
    },
    blockE: {
      hooks: ["Would need to emphasize: consulting background, client-facing work, technical communication skills"]
    },
    blockF: {
      stories: ["Would use: Customer collaboration stories, technical translation, stakeholder management"]
    },
    blockG: {
      legitimacy: "Legit — Zapier is well-established, profitable, remote-first"
    }
  }
};

function getEvaluations() {
  return Object.values(EVALUATIONS).sort((a, b) => a.rank - b.rank);
}

function getEvaluationByKey(key) {
  return EVALUATIONS[key.toLowerCase().replace(/\s+/g, '')];
}

module.exports = { getEvaluations, getEvaluationByKey, EVALUATIONS };