# Known Limitations & Future Improvements

This document documents intentional engineering trade-offs, scope simplifications, and the production roadmap.

---

## 1. Intentional Simplifications & Trade-offs

1. **Local In-Process Embeddings**:
   - *Design*: Embeddings are computed locally using `sentence-transformers/all-MiniLM-L6-v2` in the worker process.
   - *Rationale*: Guarantees $0 ongoing cost and zero external rate limits.
   - *Limitation*: Requires ~150 MB of memory on the server. In high-traffic production, this would be offloaded to a dedicated vector microservice or batched embedding queue.

2. **Mastery Update Formula**:
   - *Design*: Uses a weighted moving-average formula combining previous score, evidence count, and latest attempt accuracy rather than a complex Bayesian Knowledge Tracing (BKT) network.
   - *Rationale*: Transparent, explainable, and instantaneous without model training overhead.

3. **Synchronous/On-Demand Job Processing**:
   - *Design*: PDF processing and quiz grading execute synchronously with async IO and fallback retry logic.
   - *Rationale*: Simple setup without requiring continuous Celery/Arq worker daemon maintenance on free server tiers.

---

## 2. Future Improvements Roadmap

1. **Concept Knowledge Graph Visualizer**:
   - Render interactive force-directed graph visualization of concept prerequisites and dependencies (D3.js / React Flow).
2. **Spaced Repetition Review Queue (SM-2 Algorithm)**:
   - Schedule active recall review sessions based on the SuperMemo-2 spaced repetition interval.
3. **Multi-Document Cross-Referencing**:
   - Synthesize knowledge across multiple study projects into cross-disciplinary learning paths.
4. **Voice Interaction Mode**:
   - Audio input and realistic Socratic TTS output for hands-free audio study sessions.
