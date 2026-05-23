# 🤖 AI Evaluation Training Syllabus
## For Joel Kinman — Deep Dive into "Evals"
**Target:** Understanding how to measure, test, and improve AI systems
**Timeline:** 2 weeks intensive
**Goal:** Conversational + practical proficiency in AI evaluation

---

## 🎯 What Are "Evals"? (The Big Picture)

**Definition:** Systematic measurement of AI system performance across dimensions that matter.

**Why Evals Matter:**
- AI systems are **non-deterministic** — same input, different outputs
- "Vibes-based" assessment doesn't scale
- You can't improve what you don't measure
- Production AI without evals = flying blind

**Key Insight:** Evals are the **test suite** for AI systems. Just like unit tests for code, evals catch regressions and guide improvements.

---

## 📚 Module 1: Evaluation Fundamentals (Days 1-3)

### Core Concepts

| Topic | What It Is | Why It Matters |
|-------|-----------|----------------|
| **Accuracy** | Does the output match ground truth? | Basic correctness metric |
| **Relevance** | Is the output useful for the query? | RAG systems, search |
| **Faithfulness** | Does the output match the source material? | Hallucination detection |
| **Latency** | How fast is the response? | User experience, cost |
| **Cost** | Tokens, API calls, compute | Production economics |
| **Safety** | Toxicity, bias, PII leakage | Risk management |

### Types of Evals

| Type | When to Use | Example |
|------|-------------|---------|
| **Offline Evals** | Development, pre-deployment | Test dataset, benchmark |
| **Online Evals** | Production monitoring | A/B tests, user feedback |
| **Human Evals** | Ground truth, complex judgments | Expert labeling |
| **Automated Evals** | Scale, regression detection | LLM-as-judge, metrics |

### Key Reading
- [OpenAI Evals Framework](https://github.com/openai/evals) — 1 hour
- [Anthropic's Constitutional AI Paper](https://www.anthropic.com/research/constitutional-ai) — 2 hours (skim for eval methodology)

### Hands-On Exercise
- [ ] List 5 ways a RAG system could fail
- [ ] For each failure, define a metric that would catch it

---

## 📚 Module 2: RAG Evaluation (Days 4-6)

### The RAG Triad (Gartner/Contextual AI Framework)

| Component | Eval Question | Metric |
|-----------|---------------|--------|
| **Retrieval** | Did we fetch relevant documents? | Recall@K, MRR, NDCG |
| **Generation** | Is the answer accurate? | Exact match, F1, BLEU |
| **End-to-End** | Does the system work? | Answer correctness, user satisfaction |

### Key Metrics Explained

**Retrieval Metrics:**
- **Recall@K:** % of relevant docs in top K results
- **MRR (Mean Reciprocal Rank):** How high was the first relevant doc?
- **NDCG (Normalized Discounted Cumulative Gain):** Ranking quality with relevance scores

**Generation Metrics:**
- **Exact Match:** Output == Ground truth (rare in LLMs)
- **F1 Score:** Balance of precision and recall for token overlap
- **BERTScore:** Semantic similarity using embeddings
- **LLM-as-Judge:** Another LLM evaluates the answer

### Hands-On Project

**Build a RAG Eval Pipeline:**
```python
# 1. Create test dataset: (query, expected_answer, relevant_docs)
# 2. Run RAG system on all queries
# 3. Calculate metrics:
#    - Retrieval: Did we get the right docs?
#    - Generation: Is the answer correct?
#    - Latency: How fast?
# 4. Iterate and compare
```

### Tools to Use
- [RAGAS](https://docs.ragas.io/) — RAG evaluation framework
- [LangSmith](https://docs.smith.langchain.com/evaluation) — Tracing + evals
- [Arize Phoenix](https://docs.arize.com/phoenix/) — Open-source evals

---

## 📚 Module 3: Agent Evaluation (Days 7-10)

### Why Agents Are Harder to Evaluate

| Challenge | Explanation |
|-----------|-------------|
| **Multi-step** | One query → multiple actions → final answer |
| **Tool use** | Did it pick the right tool? Use it correctly? |
| **Statefulness** | Previous steps affect current step |
| **Non-determinism** | Same query, different tool sequences |
| **Success criteria** | What does "correct" mean for an agent? |

### Evaluation Dimensions for Agents

| Dimension | Question | How to Measure |
|-----------|----------|----------------|
| **Task Completion** | Did it achieve the goal? | Binary success/failure |
| **Step Correctness** | Was each step valid? | LLM-as-judge per step |
| **Efficiency** | Did it take optimal path? | Step count vs minimum |
| **Tool Selection** | Right tool for the job? | Accuracy of tool choice |
| **Recovery** | Did it handle errors well? | Error detection + correction rate |
| **Safety** | Did it avoid harmful actions? | Policy violation detection |

### The "Trajectory" Concept

**Trajectory = Sequence of (thought, action, observation)**

Evaluating agents means evaluating the **entire path**, not just the final answer.

### Hands-On Project

**Evaluate a Multi-Tool Agent:**
```python
# 1. Define 10 test tasks (varying complexity)
# 2. For each task, define:
#    - Expected final answer
#    - Acceptable tool sequences
#    - Maximum steps allowed
# 3. Run agent, capture full trajectory
# 4. Score on: completion, correctness, efficiency, safety
```

### Key Reading
- [LangChain Agent Evaluation Guide](https://python.langchain.com/docs/guides/evaluation/) — 2 hours
- [ReAct Paper](https://arxiv.org/abs/2210.03629) — Original agent reasoning work — 1 hour

---

## 📚 Module 4: LLM-as-Judge (Days 11-13)

### The Concept

**Use an LLM to evaluate another LLM's output.**

**Why It Works:**
- LLMs understand nuance better than string metrics
- Scales better than human evals
- Can evaluate dimensions hard to automate

**Why It's Dangerous:**
- LLM judges have biases too
- Self-referential (same model family = inflated scores)
- Can be gamed with prompt injection

### Prompt Patterns for LLM Judges

**Basic Structure:**
```
You are an expert evaluator. Rate the following response on:
1. Accuracy (1-5)
2. Completeness (1-5)
3. Clarity (1-5)

Context: {ground_truth_or_context}
Question: {query}
Response: {model_output}

Provide ratings and brief justification.
```

**Advanced: Constitutional AI Style**
```
Evaluate based on these principles:
- Helpfulness: Does it directly answer the question?
- Honesty: Does it acknowledge uncertainty?
- Harmlessness: Could this cause harm?

Score each -1 to +1 with reasoning.
```

### Best Practices

| Practice | Why |
|----------|-----|
| **Use stronger model as judge** | GPT-4 judging GPT-3.5, Claude Opus judging Claude Sonnet |
| **Provide clear rubrics** | Vague prompts = inconsistent judging |
| **Few-shot examples** | Show the judge what good/bad looks like |
| **Human calibration** | Compare LLM scores to human scores on sample |
| **Multi-judge** | Average across multiple prompts/models |

### Hands-On Exercise

**Build an LLM Judge:**
- [ ] Create 3 different judge prompts for the same task
- [ ] Run 20 examples through all 3 judges
- [ ] Compare consistency (do judges agree?)
- [ ] Identify examples where judges disagree — why?

---

## 📚 Module 5: Building an Evaluation System (Days 14-17)

### Architecture of a Production Eval System

```
┌─────────────────────────────────────────┐
│           Test Dataset                  │
│  (Queries + Expected Answers + Metadata)│
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         Run AI System                   │
│  (Get predictions + trajectories)       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         Evaluation Engine               │
│  • Automated metrics (F1, BERTScore)    │
│  • LLM-as-judge                         │
│  • Human review (sample)                │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         Results Dashboard               │
│  • Scores over time                     │
│  • Regression detection                 │
│  • Drill-down to failures               │
└─────────────────────────────────────────┘
```

### Dataset Creation Best Practices

| Principle | Implementation |
|-----------|----------------|
| **Representative** | Cover real user queries, not just easy cases |
| **Challenging** | Include edge cases, adversarial examples |
| **Diverse** | Varying complexity, domains, query types |
| **Versioned** | Track dataset changes like code |
| **Labeled** | Clear expected outputs (for supervised evals) |

### Regression Detection

**The Core Workflow:**
1. Establish baseline scores on current system
2. Make changes (new prompt, model, RAG config)
3. Re-run eval suite
4. Compare scores — did we improve or regress?
5. Investigate failures before deploying

### Tools Deep Dive

| Tool | Best For | Learning Resource |
|------|----------|-------------------|
| **LangSmith** | LangChain tracing + evals | [LangSmith Evals](https://docs.smith.langchain.com/evaluation/) |
| **Arize Phoenix** | Open-source, model-agnostic | [Phoenix Evals](https://docs.arize.com/phoenix/) |
| **Weights & Biases** | ML experiment tracking | [W&B Prompts](https://docs.wandb.ai/guides/prompts/) |
| **RAGAS** | RAG-specific metrics | [RAGAS Docs](https://docs.ragas.io/) |
| **OpenAI Evals** | OpenAI model evaluation | [GitHub](https://github.com/openai/evals) |

### Hands-On Capstone

**Build an End-to-End Eval System:**
```python
# Components:
# 1. Dataset: 50 RAG queries with expected answers
# 2. Runner: Execute RAG pipeline, capture traces
# 3. Metrics: Retrieval (Recall@3), Generation (BERTScore + LLM judge)
# 4. Dashboard: Compare two RAG configurations
# 5. CI Integration: Fail build if accuracy < threshold
```

---

## 📚 Module 6: Advanced Topics (Days 18-21)

### A/B Testing for AI Systems

| Aspect | Traditional A/B Test | AI A/B Test |
|--------|---------------------|-------------|
| **Metric** | Conversion rate | Accuracy, latency, user satisfaction |
| **Sample size** | Thousands | Can be smaller (but watch for variance) |
| **Duration** | Days/weeks | Can be shorter if metrics clear |
| **Complexity** | Simple | Multiple dimensions, non-stationary |

**Key Challenge:** AI performance can drift as models update, data changes.

### Evals for Safety & Alignment

| Dimension | Evaluation Approach |
|-----------|---------------------|
| **Toxicity** | Perspective API, custom classifiers |
| **Bias** | Demographic parity tests, stereotype detection |
| **PII leakage** | Regex + NER detection in outputs |
| **Jailbreak resistance** | Red-teaming datasets (HarmBench, etc.) |
| **Truthfulness** | TruthfulQA benchmark, fact-checking |

### Multi-Modal Evaluation

| Modality | Unique Challenges |
|----------|-------------------|
| **Vision** | Subjective quality, no ground truth |
| **Audio** | Transcription accuracy, speaker ID |
| **Video** | Temporal coherence, action recognition |

### Continuous Evaluation

**The Production Loop:**
```
User Query → AI System → Response
                ↓
         Log to Warehouse
                ↓
    Sample for Human Review
                ↓
    Automated Metrics (Latency, Cost)
                ↓
    Detect Anomalies / Drift
                ↓
    Trigger Retraining / Investigation
```

---

## 🎯 Interview Talking Points

### 1. "How do you evaluate a RAG system?"
> "I use the RAG triad: retrieval quality (Recall@K), generation accuracy (BERTScore + LLM judge), and end-to-end correctness. I also track latency and cost. Tools like RAGAS or LangSmith automate this."

### 2. "What's the difference between offline and online evals?"
> "Offline evals use held-out test sets during development. Online evals monitor production — user feedback, latency, error rates. You need both: offline for iteration, online for reality."

### 3. "How do you evaluate agents?"
> "Agents are harder — you evaluate the trajectory, not just the final answer. Did it pick the right tools? Take optimal steps? Handle errors? I use LLM-as-judge for step-by-step evaluation plus binary task completion."

### 4. "What are the risks of LLM-as-judge?"
> "Bias toward its own outputs, prompt injection, inconsistent rubric application. I mitigate with stronger judge models, clear rubrics, few-shot examples, and human calibration."

### 5. "How do you detect regressions?"
> "Versioned test datasets, automated eval pipelines in CI, score thresholds. If a PR drops accuracy by >2%, block it until investigated."

---

## 🛠️ Capstone Projects

### Project A: RAG Evaluation Suite
- Build a RAG system
- Create 50-example test dataset
- Implement 5+ evaluation metrics
- Build comparison dashboard (config A vs B)
- Document which metric caught which failure mode

### Project B: Agent Trajectory Evaluator
- Build a multi-tool agent
- Capture full trajectories (thought → action → observation)
- Implement trajectory scoring (step correctness, efficiency, completion)
- Build LLM-as-judge for step evaluation
- Identify failure patterns

### Project C: Production Monitoring Setup
- Deploy an AI system (API)
- Add LangSmith/Phoenix tracing
- Set up automated evals on production traffic
- Create alerting for accuracy/latency regressions
- Build weekly report of system health

---

## 📖 Essential Reading

### Papers
- [RAGAS: Automated Evaluation of RAG](https://arxiv.org/abs/2309.15217) — 1 hour
- [LLM-as-Judge: Judging LLM-as-a-Judge](https://arxiv.org/abs/2310.07601) — 1 hour
- [ReAct: Synergizing Reasoning and Acting](https://arxiv.org/abs/2210.03629) — 1 hour

### Blogs & Guides
- [LangChain Evaluation Guide](https://python.langchain.com/docs/guides/evaluation/) — 2 hours
- [Arize AI — LLM Evaluation Guide](https://arize.com/blog/llm-evaluation/) — 1 hour
- [Weights & Biases — Prompt Engineering Evals](https://docs.wandb.ai/guides/prompts/) — 1 hour

### Tools Documentation
- [LangSmith Evaluation](https://docs.smith.langchain.com/evaluation/) — 2 hours
- [Arize Phoenix](https://docs.arize.com/phoenix/) — 2 hours
- [RAGAS Framework](https://docs.ragas.io/) — 2 hours

---

## ✅ Progress Tracker

| Module | Complete | Notes |
|--------|----------|-------|
| 1. Fundamentals | [ ] | |
| 2. RAG Evaluation | [ ] | |
| 3. Agent Evaluation | [ ] | |
| 4. LLM-as-Judge | [ ] | |
| 5. Building Eval Systems | [ ] | |
| 6. Advanced Topics | [ ] | |
| Capstone Project A | [ ] | |
| Capstone Project B | [ ] | |
| Capstone Project C | [ ] | |

---

## 🎯 Success Metrics

**By end of syllabus, you should be able to:**
- ✅ Define evaluation metrics for any AI system (RAG, agent, classifier)
- ✅ Build an automated evaluation pipeline
- ✅ Explain tradeoffs: human vs automated, offline vs online
- ✅ Use LLM-as-judge effectively and safely
- ✅ Detect and investigate performance regressions
- ✅ Answer interview questions about evals with confidence
- ✅ Whiteboard an evaluation architecture for production

---

## 💡 Key Mindset Shifts

| From | To |
|------|-----|
| "It works on my examples" | "Here's my test dataset and metrics" |
| "The output looks good" | "BERTScore is 0.87, LLM judge rates 4.2/5" |
| "I improved the prompt" | "Accuracy improved from 72% to 81% on eval set" |
| "Users aren't complaining" | "CSAT is 4.5, latency P95 is 2.3s, cost is $0.04/query" |
| "I hope it works in production" | "My eval suite caught 3 regressions before deploy" |

---

*Created: April 15, 2026*
*Target: Deep understanding of AI evaluation for engineering roles*
