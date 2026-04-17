---
description: "Deep-dive into modern 2D game development techniques — rendering, physics, ECS patterns, particles, optimization"
mode: agent
agent: researcher
---

# Research: Modern 2D Game Dev Techniques

Conduct a **deep technical survey** of the latest techniques, algorithms, and patterns used in modern 2D game engines. Focus on approaches that are applicable to a TypeScript engine running on React Native with Skia rendering.

## Research Areas

### 1. Rendering Techniques
- Sprite batching strategies — how do modern engines minimize draw calls?
- Texture atlas packing algorithms — MaxRects, Guillotine, Shelf — which performs best?
- Camera systems — smooth follow, lookahead, screen shake, parallax scrolling implementations
- Lighting in 2D — raycast shadows, normal maps on sprites, dynamic lighting techniques
- Post-processing in Skia — blur, bloom, color grading using Skia shaders/filters

### 2. Physics & Collision
- Broadphase algorithms: spatial hash vs quadtree vs sweep-and-prune — latest benchmarks
- Narrow-phase: SAT vs GJK for 2D — when to use which
- Continuous collision detection in 2D — tunneling prevention for fast objects
- planck.js vs rapier2d-js — performance comparison, WASM viability in RN
- One-way platforms, slopes, moving platforms — common implementation patterns

### 3. ECS Patterns
- Archetype vs sparse-set ECS — which is better for 2D games with <10K entities?
- System ordering and dependency resolution
- Event-driven ECS communication patterns
- Component pooling and memory layout for cache-friendly iteration
- State machines in ECS — FSM as component vs system approaches

### 4. Particle Systems
- Modern 2D particle system architectures — CPU vs GPU compute
- Particle pooling and zero-allocation emitters
- Curve-based parameter animation (size over lifetime, color over lifetime)
- Skia-specific: can `drawAtlas` batch thousands of particles efficiently?

### 5. Animation
- Sprite animation state machines — Aseprite tag-based workflows
- Tweening libraries — which easing functions and approaches are most performant?
- Skeletal 2D animation: Spine, DragonBones — runtime formats, JS implementations
- Procedural animation: squash & stretch, anticipation, follow-through in code

### 6. Spatial Indexing & Level Design
- Quadtree vs R-tree vs grid-based spatial hashing — 2D game benchmarks
- Tiled / LDtk integration patterns — how do engines load and render tile maps?
- Chunked world loading — infinite scrolling, LOD for 2D
- Pathfinding: A* on tilemaps, navigation meshes for 2D, Jump Point Search

### 7. Performance Optimization
- JavaScript GC avoidance in game loops — object pooling patterns
- TypedArray usage for bulk entity data
- Frame budget management — 16ms target strategies
- Memory layout: struct-of-arrays vs array-of-structs in JS
- React Native specific: bridge overhead, JSI patterns, Worklet threading

### 8. Game Architecture Patterns
- Scene management: stack-based vs graph-based transitions
- Save/load serialization of ECS world state
- Deterministic game loops for replay systems
- Input buffering and command queuing for responsive controls

## Source Requirements

For each technique, find:
- **At least one implementation** — link to source code (GitHub, engine source)
- **At least one explanation** — blog post, paper, or conference talk
- **Performance data** — benchmarks if available, or theoretical complexity

Prioritize sources from:
- GDC talks and slides (especially technical 2D sessions)
- Engine source code: Phaser, Excalibur, KAPLAY, Godot (2D parts)
- Academic: IEEE/ACM game engineering papers, GPU Gems chapters
- Community: gamedev.net, gamedev.stackexchange, r/gamedev technical posts

## Output

Produce a structured report following the researcher agent's report format. For each technique, include:
1. What it is (1-2 sentences)
2. Best-in-class implementation reference
3. Applicability to Flare (considering: TypeScript, Skia renderer, React Native, mobile constraints)
4. Recommendation: adopt / adapt / skip (with justification)
