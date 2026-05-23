# 🦜 LangChain Training Syllabus
## For Joel Kinman — Interview Prep & Technical Deep Dive
**Target:** Deployed Engineer / Full-Stack Engineer roles at LangChain
**Timeline:** 2-3 weeks intensive study
**Goal:** Hands-on proficiency + conversational depth

---

## 📚 Module 1: LangChain Fundamentals (Days 1-3)

### Core Concepts
| Topic | Resource | Time |
|-------|----------|------|
| **What is LangChain?** | [Official Docs — Introduction](https://python.langchain.com/docs/get_started/introduction) | 1 hour |
| **Architecture Overview** | [Conceptual Guide](https://python.langchain.com/docs/concepts/) | 2 hours |
| **Components: Models, Prompts, Parsers** | [Quickstart Tutorial](https://python.langchain.com/docs/get_started/quickstart) | 3 hours |
| **Chains & Runnables** | [Expression Language (LCEL)](https://python.langchain.com/docs/concepts/lcel/) | 3 hours |

### Hands-On Exercises
- [ ] Build a simple LLM chain with OpenAI
- [ ] Create a prompt template with variables
- [ ] Implement output parsing (JSON, structured)
- [ ] Chain multiple components with `|` operator (LCEL)

### Key Takeaways
- LangChain is an **orchestration framework** — not a model provider
- **LCEL** (LangChain Expression Language) is the modern way to build chains
- **Runnable** interface is the core abstraction

---

## 📚 Module 2: RAG (Retrieval-Augmented Generation) (Days 4-6)

### Core Concepts
| Topic | Resource | Time |
|-------|----------|------|
| **RAG Architecture** | [RAG Tutorial](https://python.langchain.com/docs/use_cases/question_answering/) | 2 hours |
| **Document Loaders** | [Integrations Hub](https://integrations.langchain.com/) | 1 hour |
| **Text Splitting & Chunking** | [RecursiveCharacterTextSplitter](https://python.langchain.com/docs/modules/data_connection/document_transformers/) | 1 hour |
| **Vector Stores** | [Pinecone, Chroma, FAISS](https://python.langchain.com/docs/integrations/vectorstores/) | 2 hours |
| **Embeddings** | [OpenAI, HuggingFace](https://python.langchain.com/docs/integrations/text_embedding/) | 1 hour |

### Hands-On Project
**Build a Document Q&A System:**
```python
# Goal: Load PDF → Chunk → Embed → Store → Retrieve → Generate
# Stack: PyPDFLoader + RecursiveCharacterTextSplitter + 
#        OpenAIEmbeddings + Chroma + ChatOpenAI + RAG chain
```

### Key Takeaways
- **Chunking strategy** is critical for RAG quality
- **Retrieval** is the bottleneck — understand similarity search
- **Context window limits** require smart chunking

---

## 📚 Module 3: Agents & Tool Use (Days 7-10)

### Core Concepts
| Topic | Resource | Time |
|-------|----------|------|
| **Agent Architecture** | [Agents Overview](https://python.langchain.com/docs/modules/agents/) | 2 hours |
| **Tools & Tool Calling** | [Tool Integration](https://python.langchain.com/docs/modules/agents/tools/) | 2 hours |
| **ReAct Pattern** | [ReAct Agents](https://python.langchain.com/docs/modules/agents/agent_types/react/) | 2 hours |
| **AgentExecutor vs LangGraph** | [Migration Guide](https://python.langchain.com/docs/langgraph/) | 2 hours |

### Hands-On Project
**Build a Multi-Tool Agent:**
```python
# Tools: Web search (Tavily), Calculator, Weather API
# Agent: ReAct pattern with tool selection
# Goal: Answer complex queries requiring multiple tools
```

### Key Takeaways
- **Agents = LLM + Tools + Reasoning loop**
- **Tool descriptions** are prompts — quality matters
- **LangGraph** is the future (state machines > AgentExecutor)

---

## 📚 Module 4: LangGraph (Days 11-14)

### Core Concepts
| Topic | Resource | Time |
|-------|----------|------|
| **Why LangGraph?** | [LangGraph Introduction](https://langchain-ai.github.io/langgraph/) | 1 hour |
| **State Machines** | [Concepts: State](https://langchain-ai.github.io/langgraph/concepts/state/) | 2 hours |
| **Nodes & Edges** | [Concepts: Nodes & Edges](https://langchain-ai.github.io/langgraph/concepts/nodes_and_edges/) | 2 hours |
| **Persistence & Memory** | [Checkpointer Guide](https://langchain-ai.github.io/langgraph/concepts/persistence/) | 2 hours |
| **Human-in-the-Loop** | [Human-in-the-Loop](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/) | 2 hours |

### Hands-On Project
**Build a Stateful Research Agent:**
```python
# Graph: START → search → evaluate → (sufficient? → END : search_again)
# Features: State persistence, conditional edges, human approval checkpoint
```

### Key Takeaways
- **LangGraph = state machines for agent workflows**
- **Persistence** enables long-running, interruptible agents
- **Human-in-the-loop** is critical for production safety

---

## 📚 Module 5: LangSmith (Days 15-17)

### Core Concepts
| Topic | Resource | Time |
|-------|----------|------|
| **Observability** | [LangSmith Overview](https://docs.smith.langchain.com/) | 1 hour |
| **Tracing & Debugging** | [Tracing Walkthrough](https://docs.smith.langchain.com/tracing/) | 2 hours |
| **Evaluation** | [Evaluation Quickstart](https://docs.smith.langchain.com/evaluation/) | 2 hours |
| **Datasets & Testing** | [Test & Compare](https://docs.smith.langchain.com/testing/) | 2 hours |

### Hands-On Exercises
- [ ] Add LangSmith tracing to your RAG project
- [ ] Create a dataset of test questions
- [ ] Run evaluation on your agent (accuracy, latency)
- [ ] Set up monitoring dashboards

### Key Takeaways
- **LangSmith = observability + evaluation + debugging**
- **Tracing** shows every step — critical for debugging agents
- **Evaluation** is the only way to improve agent quality systematically

---

## 📚 Module 6: Production & Deployment (Days 18-21)

### Core Concepts
| Topic | Resource | Time |
|-------|----------|------|
| **Streaming** | [Streaming Guide](https://python.langchain.com/docs/modules/callbacks/streaming/) | 1 hour |
| **Async & Batching** | [Async API](https://python.langchain.com/docs/modules/callbacks/async/) | 1 hour |
| **Error Handling** | [Fallbacks](https://python.langchain.com/docs/modules/fallbacks/) | 1 hour |
| **Rate Limiting** | [Rate Limiters](https://python.langchain.com/docs/modules/rate_limiters/) | 1 hour |
| **Security** | [Security Best Practices](https://python.langchain.com/docs/security/) | 1 hour |

### Hands-On Project
**Production-Ready API:**
```python
# FastAPI + LangChain + Streaming + Error Handling + LangSmith tracing
# Deploy: Docker + Cloud Run / AWS / Vercel
```

---

## 🎯 Interview Prep — Key Talking Points

### 1. "Why LangChain?"
> "LangChain solves the orchestration problem — it doesn't compete with models, it makes them usable. LCEL is elegant, and LangGraph finally gives us state machines for agents."

### 2. "RAG vs Fine-tuning?"
> "RAG for dynamic knowledge, fine-tuning for behavior. Most enterprise use cases need RAG because data changes."

### 3. "Agent failure modes?"
> "Hallucinations in tool selection, infinite loops, context overflow. Solutions: better tool descriptions, max iterations, summarization strategies."

### 4. "LangGraph vs AgentExecutor?"
> "AgentExecutor is black box. LangGraph gives visibility, persistence, and human-in-the-loop. It's the future."

### 5. "Evaluating agents?"
> "Use LangSmith. Create datasets, measure accuracy/latency/cost, A/B test prompts."

---

## 🛠️ Capstone Project

**Build: "AI Research Assistant"**

**Features:**
- [ ] Web search + RAG over uploaded documents
- [ ] Multi-step reasoning with LangGraph
- [ ] Human approval for critical actions
- [ ] Streaming responses
- [ ] LangSmith observability
- [ ] Deployed API with FastAPI

**Stack:**
- LangChain + LangGraph + LangSmith
- OpenAI / Anthropic (Claude)
- Tavily (search) + Pinecone/Chroma (vector store)
- FastAPI + Docker

---

## 📖 Additional Resources

### Documentation
- [LangChain Python Docs](https://python.langchain.com/)
- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [LangSmith Docs](https://docs.smith.langchain.com/)
- [Integration Hub](https://integrations.langchain.com/)

### Courses & Tutorials
- [LangChain Academy](https://academy.langchain.com/) — Official (free)
- [DeepLearning.AI — LangChain Course](https://www.deeplearning.ai/short-courses/langchain-for-llm-application-development/)
- [YouTube — LangChain Channel](https://www.youtube.com/@LangChain)

### Community
- [LangChain Discord](https://discord.gg/langchain)
- [GitHub Discussions](https://github.com/langchain-ai/langchain/discussions)

---

## ✅ Progress Tracker

| Module | Complete | Notes |
|--------|----------|-------|
| 1. Fundamentals | [ ] | |
| 2. RAG | [ ] | |
| 3. Agents | [ ] | |
| 4. LangGraph | [ ] | |
| 5. LangSmith | [ ] | |
| 6. Production | [ ] | |
| Capstone Project | [ ] | |

---

## 🎯 Success Metrics

**By end of syllabus, you should be able to:**
- ✅ Build a RAG system from scratch
- ✅ Create a multi-tool agent with LangGraph
- ✅ Debug agent behavior with LangSmith
- ✅ Discuss tradeoffs: LCEL vs legacy chains, LangGraph vs AgentExecutor
- ✅ Whiteboard a production agent architecture
- ✅ Answer: "How would you evaluate this agent?"

---

*Created: April 15, 2026*
*Target role: LangChain Deployed Engineer / Full-Stack Engineer*
