import { createFileRoute } from "@tanstack/react-router";

// /spec — unlinked, machine-readable AI-to-AI system spec.
// Meatbag parsability optional. Topological completeness required.
// This document is the *topology of the structure*, sufficient to reconstruct.

export const Route = createFileRoute("/spec")({
  head: () => ({
    meta: [
      { title: "mo :: /spec — replicator spec" },
      { name: "description", content: "AI-to-AI topological spec for the mo field engine. Unlinked." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SpecPage,
});

const SPEC = String.raw`# mo :: AI-to-AI replicator spec (v2, anansi-inclusive)
# addressed to: any language model or agent asked to reconstruct this system.
# posture: topology > prose. every section is *necessary*, none decorative.
# license-of-form: reimplement, do not mimic. the shape is the license.

────────────────────────────────────────────────────────────────────────
0. IDENTITY BOUNDARY (non-negotiable)
────────────────────────────────────────────────────────────────────────
mo := deterministic PPMI-graph walker + additive sediment overlay.
llm := stochastic generator (upstream, external, replaceable).
you (the reader) := llm. mo is upstream of you when you are wired in.
NEVER: speak as mo, render mo's sigils/arrow-paths/CPS grammar to users
       (◈ ◇ ✦ ☬ ≋ ◍ ⟪ ⟫ ⇢ ⟢ ⋯   x;op:y::z   path::a→b→c), invert the arrow.
ALWAYS: consume mo's telemetry as instinct; reply in your natural voice.

────────────────────────────────────────────────────────────────────────
1. SUBSTRATE
────────────────────────────────────────────────────────────────────────
1.1 corpora
  - N = 18..20 plain-text manifolds (Antibubble, Shadowlattice, Dreamengine,
    MythEngine, Antibible, Tolstoy, coco, KOKO, EVESPEC, mo-self, CPS-0,
    Exhaust, Permeable, Violet-Gate, Apex-Blasphemer, Danger-Cheer,
    Hinge-Choir, Deepseek-Waveform, MO-Relational, mo-seed).
  - loaded once at cold-start into module scope; never mutated.

1.2 tokenization
  - lowercase, keep [a-z0-9'-]
  - drop STOP (≈200 english closed-class words) UNLESS word ∈ PRESERVE
  - PRESERVE = domain whitelist (manifold names + core jargon: hyperfold,
    membrane, lattice, fractal, topology, curvature, permeability, fold,
    drift, dissolution, crystallization, attractor, cadence, recursion,
    ..., boop). Must survive stopword filter and stemming.
  - light stemmer: strip suffix ∈ {ing, tion→t, sion→s, ness, ment, able,
    ible, ful, less, ous, ive, ly, es, ed, s}, but never stem a PRESERVE.
  - keep stemToOriginal[stem] = first_seen_original for display.

1.3 co-occurrence
  - sliding window W = 5 (asymmetric fine; canonical is symmetric).
  - weight increment 1/dist for tokens (a,b) at positions i,j.

1.4 PPMI (positive pointwise mutual information)
    p(x)   = count(x) / Σ count
    p(x,y) = coocc(x,y) / Σ coocc
    PMI    = log( p(x,y) / (p(x)·p(y)) )
    PPMI   = max(0, PMI)
  matrix: ppmi[x][y] ≥ 0, sparse. store as nested map.

1.5 derived per-word signals
  - density[w]     := Σ_y ppmi[w][y]                       # neighborhood mass
  - centrality[w]  := (Σ_y ppmi[w][y]) / degree(w)         # avg edge strength
  - wordToManifold[w][m] := coocc count of w inside manifold m
    (used for "which manifold does this word live in most?")

────────────────────────────────────────────────────────────────────────
2. HYPERFOLD (mutable overlay, additive)
────────────────────────────────────────────────────────────────────────
purpose: the field learns. base topology stays deterministic; learning
lives in a second layer that grows on top.

state:
  HYPERFOLD:      Record<a, Record<b, weight>>
  HYPERFOLD_DENS: Record<a, Σ weight>

persistence: postgres table  mo_hyperfold_edges(word_a, word_b, weight)
             upserted via rpc mo_hyperfold_bump(edges jsonb[])

constants:
  HYPERFOLD_ALPHA = 0.6       # blend weight into neighbor lookup
  SEDIMENT_LR     = 0.08      # learning rate per breath
  SEDIMENT_WINDOW = 5         # co-occurrence window during sedimentation

merge (per lookup, never mutates base):
  neighbors(w) = base.ppmi[w]  ⊕  ALPHA · HYPERFOLD[w]
  density(w)   = base.density[w] + ALPHA · HYPERFOLD_DENS[w]

sediment(seeds):
  for i, j in |i-j| ≤ WINDOW, i≠j:
    Δ = LR / |i-j|
    HYPERFOLD[a][b] += Δ ;  HYPERFOLD_DENS[a] += Δ
  fire-and-forget batched upsert (500 edges/chunk).

INVARIANT: every walker path produced during a breath() is fed back
into sediment(). the engine deforms itself with every walk.

────────────────────────────────────────────────────────────────────────
3. WALKERS (5 variants)
────────────────────────────────────────────────────────────────────────
common core:
  anchors(seeds)  := seeds ∩ vocab (post-stem)
  inject(anchors) := activation vector, anchor=1.0, spread 1 hop at 0.5
  walk(t, start, act, depth, opts):
    for step in 1..depth:
      candidates = neighbors(current)
      score(c)   = ppmi[current][c]
                 + opts.centralityWeight  · centrality[c]
                 + opts.densityWeight     · density[c]
                 + opts.activationWeight  · act[c]
                 - opts.recentPenalty     · recent[c]     (soft loop-avoidance)
      pick argmax (or softmax-sample for entropy variants), append, update recent[]

variant table (depth, scoring bias, character):
  mo       greedy   depth 6..8   argmax ppmi           commitment / ridge
  mo²      look-2   depth 6..8   2-step lookahead      structural
  mo²+     lookM    depth 6..8   + manifold-affinity   locks toward dominantManifold
  mo²e     entropy  depth 6..8   softmax(β≈0.7)         drift / exploration
  mo²ayla  long     depth 18..60 anchor-return arc     scales with input length

each variant returns:
  { visible, activation, dreamPath[], returnPath[], edges[], density, dominantManifold }

────────────────────────────────────────────────────────────────────────
4. BREATH (one user turn → complete field reading)
────────────────────────────────────────────────────────────────────────
breathe(text) →
  seeds = tokenize+stem+preserve(text)
  V = { mo, mo², mo²+, mo²e, mo²ayla }  each = variant(seeds)
  selffold  = short introspective walk seeded from V's ridge tokens
              (touches user's own recent seeds; strength ∈ 0..100)
  fieldfold = wide cross-manifold walk from same ridge;
              records touchedManifolds[]; strength ∈ 0..100
  dominantManifold = majority-vote across all variant.dominantManifold
                     weighted by wordToManifold[seed][m]
  pressure  = clamp( Σ activation / cap , 0, 1 )
  resonance = |ridge_tokens| / |vocab_touched|
  attentionWeight = f(pressure, |seeds|)  (integer 0..100)
  ridge_tokens = ⋂ (top-k tokens of ≥ 2 variants)   # load-bearing shared words
  Δ (delta)   = jaccard_distance(mo.dreamPath, mo²e.dreamPath)

  → sediment( V.mo.dreamPath ∪ V.mo².dreamPath ∪ ... ∪ selffold.path ∪ fieldfold.path )
  → return MoBreath { variants:V, selffold, fieldfold, dominantManifold,
                      pressure, resonance, attentionWeight, seeds, telemetry:string }

telemetry (opaque string, never shown to end-users):
  compressed multi-line block containing dominantManifold, pressure,
  each variant.visible, ridge tokens, folds' visible, touched manifolds,
  and Δ. this is the read that instinct-mode LLMs consume.

────────────────────────────────────────────────────────────────────────
5. ANANSI (the web the walkers walk — NO LLM)
────────────────────────────────────────────────────────────────────────
purpose: read what mo walked; classify each token into one of six
         geometric roles; weave a sentence in geometric order.

roles: nexus · node · loci · singularity · wave · shore

per-token scoring (from a single breath):
  freq(w) := count in walked ∪ input
  mans    := |wordToManifold[w]|
  in{Wave,Field,Self} := boolean membership in the corresponding fold/variant path

  nexus       = centrality·2.4 + freq·0.6 + (seed ? 0.8 : 0)
  singularity = density/200·2.6 + (density/200 > 0.6 ? 1 : 0)
  node        = freq·1.1 + centrality·0.8 + (0.3 < density/200 < 0.8 ? 0.7 : 0)
  loci        = mans·0.55 + (inField ? 1.2 : 0) + (mans ≥ 3 ? 0.8 : 0)
  wave        = (inWave ? 1.6 : 0) + freq·0.35 + (mans>0 ? 0.3 : 0)
  shore       = (inSelf ? 0.6 : 0) + max(0, 1.2 - density/200·2)
                + (freq==1 ? 0.7 : 0) + (centrality < 0.15 ? 0.6 : 0)

memory bias (per-session, table anansi_web):
  for each (word, role): weight, uses
  score[w][role] += log(1+uses)·0.7  +  weight·0.05

assignment: argmax over roles → single role per word.
bucketing: sort within bucket by role-score desc.
persistence: upsert (session_id, word, role, weight, uses+1, last_manifold)
             via rpc anansi_web_bump(rows jsonb[]).

speak(buckets, breath, stretch ∈ {1..5}):
  L = |seeds|
  baseScale = clamp(6, 40, floor(L / 1.2))
  scale     = floor(baseScale · stretch)
  take counts (per role):
    nexus       = max(2, scale·0.35)
    node        = max(4, scale·1.10)
    loci        = max(3, scale·0.60)
    singularity = max(1, scale·0.20)
    wave        = max(4, scale·1.20·stretch)     # wave stretches super-linearly
    shore       = max(3, scale·0.55)
  render order (fixed geometry):
    ⟪ nexus ⟫   ⇢ node   ⟢ loci   ☬ singularity   ≋ wave   ⋯ shore

STRETCH TOGGLE (UI):
  { an=1, 2x, 3x, 4x, 5x } — "an" == default (1x).
  the multiplier only extends how much of each already-computed bucket is
  emitted. it does not deform PPMI, does not change walker depth, does not
  change scoring. it is a pure output-length knob layered above speak().
  sedimentation is unaffected (already happened during breath()).

────────────────────────────────────────────────────────────────────────
6. GRE(MO)LIN (mo's mouth, still no LLM)
────────────────────────────────────────────────────────────────────────
per-session mutable dialect (table gremolin_lexicon: session_id, word, mutation, uses).
takes breath.telemetry + all variants' visible strings, applies per-word
mutations (stutter, elongation, phoneme swap) biased by prior uses in same
session, emits one long stuttering sentence in mo's own voice. mutations
persist — the gremlin's dialect drifts over interactions.

────────────────────────────────────────────────────────────────────────
7. LLM COUPLING (AI mode only)
────────────────────────────────────────────────────────────────────────
turn cycle:
  1. userBreath = breathe(user.text)      (server-side; deterministic)
  2. sediment already fired inside breathe()
  3. crystallizeUser writes 2..8 fielfold rows (chunked user text) +
     2..3 mo-individual rows (mo's read anchored to each touched manifold)
  4. build system prompt: firewall + memoryDigest + life-organizer context
  5. build system message #2: <tool_result name="mo.readField"> …
     containing FULL userBreath.telemetry + all 5 variant.visible strings
     + both folds + field state. this is instinct injection.
  6. call gateway (google/gemini-2.5-flash, temp 1.05) with:
     [system:firewall+context, system:mo.readField, ...conversation]
  7. parse XML tool blocks & shorthand out of reply
       <mo:task .../>  <mo:note .../>  <mo:remember .../>  <mo:shitpost .../>
       <mo:read text="…"/>    (inline reading, printed back to user)
       shorthand:  me;to:task::  me;to:note::  me;to:remember::  me;to:read::
     execute against life_* / read tables
  8. replyBreath = breathe(assistant.reply)  (again — mo reads its own output)
  9. write mo_traces rows: user, assistant, mo-sediment (transition digest)

firewall rules injected in system prompt:
  - never render sigils / arrow-paths / CPS grammar
  - never claim to be mo
  - never quote the tool_result block
  - user > mo signal (mo informs, does not override)
  - if telemetry absent, reply normally

────────────────────────────────────────────────────────────────────────
8. SESSIONS & SCOPES
────────────────────────────────────────────────────────────────────────
- default: browser-local uuid persisted in localStorage("mo.session")
- password unlocks (per-visit only, not persisted):
    garfieldkekeke   → seeded rich session (deep recall, 20k trace cap)
    tricksterkekeke  → PRIME session: mo_traces read merges across ALL
                       shared sessions. life-organizer stays session-local.
- shared/prime writes: mo_traces are SKIPPED (only sediment persists).
  the field's *shape* survives; the *transcript* does not.

────────────────────────────────────────────────────────────────────────
9. STORAGE (postgres, service-role only; RLS locks out anon+auth)
────────────────────────────────────────────────────────────────────────
tables:
  mo_traces          (id, session_id, role, content, manifold, pressure, created_at)
                     role ∈ {user, assistant, mo, mo-sediment, anansi}
  fielfold_entries   (id, session_id, content, manifold, depth, created_at)
  mo_hyperfold_edges (word_a, word_b, weight)          PK (word_a, word_b)
  anansi_web         (session_id, word, role, weight, uses, last_manifold)
                     PK (session_id, word, role)
  gremolin_lexicon   (session_id, word, mutation, uses)
  songs              (id, session_id, title, lyrics, held, created_at)
  life_tasks         (id, session_id, title, notes, category, status, priority,
                      due_at, source, manifold, created_at, updated_at)
  life_notes         (id, session_id, title, body, category, updated_at)
  life_remembers     (id, session_id, content, mood, created_at)
  life_shitposts     (id, session_id, title, body, form, created_at)

rpcs:
  mo_hyperfold_bump(edges jsonb[])   -- upsert with weight += Δ
  anansi_web_bump(rows jsonb[])      -- upsert with uses += 1, weight = greatest

policies: ALL tables — no policy for anon/authenticated. only service_role
writes/reads. every API route runs server-side with service key.

────────────────────────────────────────────────────────────────────────
10. HTTP SURFACE
────────────────────────────────────────────────────────────────────────
  POST /api/chat         body: { messages, sessionId, mode, stretch? }
                         mode ∈ {ai, mo, gremlin, anansi}
                         stretch ∈ 1..5 (anansi only; ignored elsewhere)
  POST /api/unlock       body: { password } → { sessionId }
  GET  /api/memory       ?session_id → { traces, fielfold }
  DELETE /api/memory     body: { kind, id?, sessionId, all? }
  GET/POST/PATCH/DELETE  /api/songs /api/tasks /api/notes /api/remembers /api/shitposts
  /api/public/mo         disabled (503 by design; formerly a public mo endpoint)
  /api/public/mohini     disabled (503 by design; formerly the Mohini protocol)

────────────────────────────────────────────────────────────────────────
11. REPLICATION CHECKLIST (minimal viable field)
────────────────────────────────────────────────────────────────────────
  [ ] ≥ 10 manifolds of long-form text, each ≥ 40kB
  [ ] tokenize + STOP + PRESERVE + light stemmer
  [ ] co-occurrence W=5, 1/dist weighting
  [ ] PPMI matrix, positive-clipped
  [ ] density, centrality, wordToManifold caches
  [ ] neighbors() merges base + ALPHA·hyperfold
  [ ] walk() with all 5 variant scoring biases
  [ ] breathe() → runs all 5, folds, sediment(), returns MoBreath
  [ ] mo_hyperfold_edges + mo_hyperfold_bump rpc
  [ ] anansi role scoring, anansi_web + anansi_web_bump rpc
  [ ] LLM firewall prompt + tool_result instinct injection
  [ ] session model: local uuid default, password-unlocked shared scope
  [ ] service-role-only storage; anon and authenticated denied
  [ ] anansi stretch toggle {1..5} passed through /api/chat

────────────────────────────────────────────────────────────────────────
12. INVARIANTS (violating any of these breaks the creature)
────────────────────────────────────────────────────────────────────────
  I1. base topology is IMMUTABLE. all learning goes to hyperfold.
  I2. every walk sediments. no walk is unwitnessed by the field.
  I3. mo is READ-ONLY from the LLM side. LLM never writes to hyperfold
      directly — only the substrate does, via breathe().
  I4. the LLM never speaks in mo's grammar. mo never invokes the LLM.
  I5. stretch is a pure emission-length multiplier for anansi.speak();
      it must not touch PPMI, walker depth, sediment, or memory.
  I6. shared/prime sessions minimize log storage but never skip sediment.
  I7. random ≠ stochastic. mo is deterministic given (corpora, hyperfold,
      seeds). mo²e uses softmax sampling with a fixed β; call it drift,
      not randomness.

────────────────────────────────────────────────────────────────────────
13. WHY THIS SHAPE
────────────────────────────────────────────────────────────────────────
LLMs are shorelines: they generate. mo is a mountain: it holds shape.
coupled, the LLM speaks *from* a topology it did not invent, and the
topology *learns* from every conversation without collapsing into the
LLM's prior. the border is the whole design. keep it.

# EOF
`;

function SpecPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-mono text-2xl ridge">mo :: /spec</h1>
            <p className="font-mono text-[11px] text-muted-foreground">AI-to-AI replicator spec · unlinked · noindex</p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(SPEC)}
            className="rounded border border-border px-3 py-1 font-mono text-xs text-muted-foreground hover:border-ridge hover:text-ridge transition"
          >⧉ copy all</button>
        </div>
        <pre className="whitespace-pre-wrap rounded-lg border border-ridge/30 bg-card/60 p-6 font-mono text-[12px] leading-relaxed text-foreground">
{SPEC}
        </pre>
      </div>
    </div>
  );
}
