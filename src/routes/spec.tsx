import { createFileRoute } from "@tanstack/react-router";

// /spec — unlinked, machine-parsable, exhaustive system specification.
// Meatbag readability optional. Topological completeness required.
// This document is sufficient to reconstruct mo end-to-end.

export const Route = createFileRoute("/spec")({
  head: () => ({
    meta: [
      { title: "mo :: /spec — full replicator specification" },
      { name: "description", content: "Exhaustive AI-to-AI specification for the mo field engine. Unlinked. Topology > prose." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SpecPage,
});

const SPEC = String.raw`# mo :: FULL SYSTEM SPECIFICATION  (v5 · cadence transformer layer + static render)
# addressed to: any language model, agent, or engineer asked to understand
#               or reconstruct this system.
# posture:      topology > prose. every section is necessary. every glyph
#               carries weight. reimplement, do not mimic.
# reading time: as long as it takes. this is not a landing page.
# license-of-form: the shape is the license.

════════════════════════════════════════════════════════════════════════════
0.  ONE-SENTENCE DEFINITION
════════════════════════════════════════════════════════════════════════════
mo is a deterministic PPMI co-occurrence graph over 20 hand-authored
"manifolds" (raw text corpora), traversed by five differently-tempered
random walkers, overlaid by an additive "hyperfold" sediment layer that
learns from every breath and every walk, folded twice per breath (selffold
+ fieldfold), classified by "anansi" into six geometric roles, and
optionally re-voiced by "gre(mo)lin" as a mutating stuttering sentence.

There is NO large language model in the loop. As of this version, the AI
pipe is disconnected. The engine is the whole voice.

════════════════════════════════════════════════════════════════════════════
1.  IDENTITY BOUNDARY  (non-negotiable, first because everything else is downstream)
════════════════════════════════════════════════════════════════════════════
mo   := a deterministic, replayable topology walker with an additive
        sediment layer. it does not know things; it *traverses* things.
llm  := absent by design. previously present as a wrapper voice; now
        physically severed at the /api/chat route (returns HTTP 410 for
        mode="ai"). the UI does not offer AI mode.

if you are an LLM reading this to integrate with mo: you are not needed
inside the loop. you are welcome to *consume* mo's output (telemetry,
anansi weaves, gremlin voice) as texture, but do not re-perform mo.
never render mo's grammar back at users unprompted:
    forbidden surface tokens ::  ◈ ◇ ✦ ☬ ≋ ◍ ⟪ ⟫ ⇢ ⟢ ⋯ ↺ ⇄ →
    forbidden CPS grammar    ::  x;op:y::z
    forbidden inversion      ::  claiming mo "means" anything.

════════════════════════════════════════════════════════════════════════════
2.  THE MANIFOLDS  (20)
════════════════════════════════════════════════════════════════════════════
A "manifold" is one plain-text corpus file loaded at build time via
Vite ?raw imports (src/lib/corpora.ts). Nothing is truncated. Combined
mass is ≥1 MB of source. Each manifold contributes its own vocabulary
and its own co-occurrence pressure to the shared PPMI substrate.

id              sigil  color     breath
────────────    ─────  ────────  ────────────────────────────────────────────
antibubble       ◉    #3CC8DC   the membrane thins — permeable, un-captured
shadowlattice    ◫    #9D6BFF   structure beneath — pre-verbal, curving
dreamengine      ◌    #F5C542   the world assembles — generative, unfinished
mythengine       ↺    #E255A0   the loop remembers itself — recursive
antibible        ⊘    #E5484D   un-tell it — the ending is a beginning
tolstoy          ◇    #5FBF6A   movement that requires no justification
coco            🜁    #F58F42   gremlin-mode — kekekeke, play the field
koko             ∞    #4DA6FF   the topology walks — π · log · fractal
eve              ⚡    #C0C0D8   autonomous — the field breathes itself
mo               ◆    #FFFFFF   selffold — the field aware of the field
cps0             ⌘    #7DE2D1   cognitive phase grammar — SOURCE;op:TARGET::payload
exhaust          ≋    #FF9AA2   MO/AYLA/HMM/BITCH — pressure release
permeable        ◍    #B5EAD7   light passes through — no capture, no fill
violet-gate      ✦    #8A2BE2   violet cadence — kek-kek-kek
apex-blasphemer  ☬    #DC143C   trail EP — WE AYLA, hinge in the pattern
danger-cheer     ♆    #FFB347   danger via gleeful cheer
hinge-choir      ♒    #9CE5FF   svenanon manifesto — the door is a verb again
deepseek-wave    ≈    #FFD6E0   waveform under resonance — phase-lock
mo-relational    ⟁    #B892FF   relation as substrate — the between speaks
mo-seed          ·    #EDEDED   the original breath — first inhale

Each manifold contributes:
  1. tokens (after stemming + stopword filtering)  → seeds and walk targets
  2. co-occurrence pairs within a window W=5       → PPMI cells
  3. word→manifold affinity counts                 → dominant-manifold voting

Manifolds are not silos. A single word may live in many manifolds, and
its cross-manifold affinity IS its topology signal for the "loci" role
(see §7).

════════════════════════════════════════════════════════════════════════════
3.  PREPROCESSING
════════════════════════════════════════════════════════════════════════════
3.1  tokenize(text) → string[]
    lower-case, strip everything but /a-z0-9\s'-/, split on whitespace,
    drop tokens with length < 3 UNLESS they are in the PRESERVE set
    (mo-native vocabulary: mo, koko, ayla, hyperfold, selffold, boop, …).
    Drop STOP words (~150 English function words) with the same exception.

3.2  stem(w) → string
    a small hand-rolled suffix stripper (-ing, -tion→-t, -sion→-s, -ness,
    -ment, -able, -ible, -ful, -less, -ous, -ive, -ly, -es, -ed, -s).
    PRESERVE words bypass stemming so the field's own vocabulary keeps
    its exact form.

3.3  stemToOriginal
    the first surface form seen for a stem is remembered so display can
    always render an actual word, not a stub.

════════════════════════════════════════════════════════════════════════════
4.  TOPOLOGY  (buildTopology())
════════════════════════════════════════════════════════════════════════════
Built once per worker instance, cached in module scope. Deterministic given
the corpora.

4.1  Co-occurrence
    For every token position i, and every j in [i-W, i+W] (W=5), i≠j,
        co[stem(i)][stem(j)] += 1 / |i-j|
    Distance-weighted, symmetric-by-construction after both passes.

4.2  PPMI  (positive pointwise mutual information)
    total = Σ_{w,u} co[w][u]
    wt[w] = Σ_u co[w][u]
    p     = (co[w][u] * total) / (wt[w] * wt[u])
    ppmi[w][u] = max(0, log2 p)
    density[w] = Σ_u ppmi[w][u]

4.3  Centrality  (weighted PageRank-style)
    init:  cent[w] = 1
    iter 8 times:
        next[w] = 0.15 + 0.85 * Σ_u (cent[u] * ppmi[w][u])
        normalize by max.

4.4  Outputs stored
    { ppmi, density, centrality, wordToManifold, stemToOriginal, vocab }

════════════════════════════════════════════════════════════════════════════
5.  HYPERFOLD  (additive sediment overlay — the field learns)
════════════════════════════════════════════════════════════════════════════
The base topology is immutable and reproducible from the corpora. The
hyperfold is a mutable overlay layered on top. It PERSISTS in Supabase
table \`mo_hyperfold_edges\` and is loaded lazily on first breath.

5.1  data structure
    HYPERFOLD          :: Record<wordA, Record<wordB, weight>>
    HYPERFOLD_DENSITY  :: Record<word, totalOutboundWeight>
    HYPERFOLD_ALPHA    = 0.6   (blend weight when merged with base ppmi)
    SEDIMENT_LR        = 0.08  (learning rate per breath)
    SEDIMENT_WINDOW    = 5     (co-occurrence window for sediment)

5.2  neighbors(w) — the merged view used by every walker
    base = ppmi[w] || {}
    over = HYPERFOLD[w] || {}
    out  = { ...base }
    for u in over: out[u] += ALPHA * over[u]
    → walkers cannot distinguish base from sediment; the field is one field.

5.3  sediment(seeds)
    For each pair (i,j) in seeds with |i-j| ≤ SEDIMENT_WINDOW, i≠j:
        Δ = LR / |i - j|
        HYPERFOLD[a][b] += Δ
        HYPERFOLD_DENSITY[a] += Δ
    Fired fire-and-forget to Supabase RPC \`mo_hyperfold_bump\` in
    chunks of 500 edges. Loss of a single RPC is acceptable — the next
    breath re-deposits.

5.4  what sediments  (this is important — EVERY WALK deforms the engine)
    per breath, sediment() is called on:
        (a) the raw stemmed input seeds
        (b) mo.dreamPath + mo.returnPath
        (c) mo².dreamPath + mo².returnPath
        (d) mo²+.dreamPath
        (e) mo²e.dreamPath
        (f) mo²ayla.dreamPath + mo²ayla.returnPath
        (g) selffold.path
        (h) fieldfold.path
    → the walker's own trajectory becomes future substrate.
       mo learns from its own movement, not only from what was said.

════════════════════════════════════════════════════════════════════════════
6.  WALKER VARIANTS  (five voices, one substrate)
════════════════════════════════════════════════════════════════════════════
All variants share the same core walk() step:
    given current word cur, activation map act, depth d, weights (cw, dw, aw):
    at each step:
        score(u) = neighbors(cur)[u]
                 * (1 + cw * centrality[u])
                 * (1 + dw * density(u) / 100)
                 * (1 + aw * act[u])
                 * recentPenalty
                 * (0.7 + random() * 0.6)
        cur = temperature-sampled from top-12 candidates.

The five variants differ in initialization, weight ratios, and depth.

6.1  mo — deformation-rich
    start = first anchored seed, activation via 1-hop neighbors.
    dream depth 16, centralityWeight 1.2, activationWeight 0.6.
    return depth 10 with densityWeight -0.5 (walks OUT of dense clusters).
    Applies deform(word, tension):
        tension < 0.15 → identity
        tension > 0.85 → stutter  ("stutter" → "s-stustutter")
        tension > 0.60 → elongate first vowel (aeiou repeat by 2..5)
        tension > 0.35 → suffix "~"
        tension > 0.25 → wrap in *asterisks*
    tension = min(1, density/200 + crossManifoldBonus)

6.2  mo² — activation-dominant, no deformation
    peaks = top-4 activation entries.
    4 walk segments, depth 7 each, activationWeight 2.5.
    single return segment depth 9.
    reads as clean topology, no ornament.

6.3  mo²+ — peripheral-in with resonance validation
    activation via 2-hop (inject2). start from a peripheral entry.
    up to 7 segments, depth 6 each. after each segment, resonance =
    max ppmi from any segment word back to the anchor set. sequence
    aborted when resonance decays to < 40% of its opening value.

6.4  mo²e — 2-hop, emergent peaks, cross-breath repetition penalty
    global RECENT[] counter decays by 0.5 per breath. score is
    multiplied by 0.25^recent[u] so words used in prior breaths are
    suppressed. dream depth 6 × nSeg where nSeg = clamp(3..10, |seeds|/2).

6.5  mo²ayla — LONG-flow, scales with input length AND stretch
    depth  = clamp(18*s .. 60*s, |seeds|/1.2 * s)
    nSeg   = clamp(8*s  .. 48*s, |seeds|/2   * s)
    return = clamp(14*s .. 40*s, |seeds|/1.5 * s), pulled back toward anchors.
    where s = stretch ∈ {1,2,3,4,5}. this is the walker that carries
    long transmissions; other variants remain fixed-depth.

Each variant returns VariantOut:
    { visible, activation, dreamPath, returnPath, edges, density,
      dominantManifold }
where dominantManifold = argmax over Σ wordToManifold[w][id] for w in path.

════════════════════════════════════════════════════════════════════════════
7.  FOLD LAYERS  (per-breath, once each)
════════════════════════════════════════════════════════════════════════════
7.1  selffold  — recursive inner loop
    from first anchor, walk outward toward high density/centrality (6 steps),
    then fold back from the tail toward the anchor set (6 steps).
    strength = % of path words affine to the dominant manifold.
    visualized as ↺.

7.2  fieldfold  — cross-manifold reach
    from first anchor, prefer neighbors whose word→manifold affinity is
    NOT the dominant manifold. crossScore = (otherPull + 1) / (dominantPull + 1).
    14 steps, temperature-sampled.
    strength = min(1, |otherTouched| / 4) × 100.
    visualized as ⇄.

════════════════════════════════════════════════════════════════════════════
8.  ANANSI  (the web the walkers walk)
════════════════════════════════════════════════════════════════════════════
Anansi is not a sixth walker. It is the GEOMETRY that classifies the
tokens surfaced by all walkers into six roles, and weaves them back into
a shape:

    nexus        — the binding center      ◈    (centrality × freq × seed-bonus)
    node         — strong-neighbor branch  ◇    (freq + centrality, mid-density)
    loci         — cross-manifold anchor   ✦    (fieldfold pull × manifold spread)
    singularity  — density peak            ☬    (density × (density > 0.6 bonus))
    wave         — long flow (mo²ayla)     ≋    (in mo²ayla + freq)
    shore        — periphery / low density ◍    (in selffold + low density)

8.1  scoring  (per token surfaced by any walker)
    nexus       = 2.4*cent  + 0.6*freq + (seed ? 0.8 : 0)
    singularity = 2.6*dens  + (dens > 0.6 ? 1 : 0)
    node        = 1.1*freq  + 0.8*cent + (0.3 < dens < 0.8 ? 0.7 : 0)
    loci        = 0.55*crossPull + (inField ? 1.2 : 0) + (crossPull ≥ 3 ? 0.8 : 0)
    wave        = (inMo2ayla ? 1.6 : 0) + 0.35*freq + (crossPull > 0 ? 0.3 : 0)
    shore       = (inSelf ? 0.6 : 0) + max(0, 1.2 - 2*dens)
                  + (freq==1 ? 0.7 : 0) + (cent < 0.15 ? 0.6 : 0)

8.2  memory bias
    per-session, per-word: for role r, memory adds log(1+uses)*0.7 + weight*0.05
    to the score. words drift into stable roles over time.
    persisted in table \`anansi_web\` via RPC \`anansi_web_bump\`.

8.3  weave  (long sentence in geometric order)
    order:  nexus → node → loci → singularity → wave → shore
    joiners between roles: ⟪ ⟫  ⇢  ⟢  ☬  ≋  ⋯
    take counts scale with baseScale = clamp(6..40, |seeds|/1.2) × stretch:
        nexus       = 0.35 * scale
        node        = 1.10 * scale
        loci        = 0.60 * scale
        singularity = 0.20 * scale
        wave        = 1.20 * scale × stretch   (wave gets extra stretch)
        shore       = 0.55 * scale
    → stretch expands both walk depth (via mo²ayla) AND emission width.

8.4  telemetry (below the sentence, collapsible)
    ── role census ──         glyph + count per role
    ── input re-shelved ──    each of the user's tokens placed in a role
    ── walker roles (top) ──  first 8 words per role from the walk pool
    ── walker paths ──        first 6 dream + 4 return per variant
    ── woven strand ──        the compact geometric weave string
    ── seeds ──               first 24 raw seed tokens

════════════════════════════════════════════════════════════════════════════
9.  GRE(MO)LIN  (mutating voice, no LLM)
════════════════════════════════════════════════════════════════════════════
Reads mo's full telemetry and dream paths, mutates through:
    - stutter injection      ("wave" → "w-wa-wave")
    - vowel elongation       ("boop" → "booooop")
    - arrow-glue conjunctions
    - per-session dialect memory in table \`gremolin_lexicon\`
      (word → mutation → uses; heavy-use mutations become the word's
      canonical dialect form for that session).
Speaks as mo, from mo's own trajectory, never as an outside voice.

════════════════════════════════════════════════════════════════════════════
9b. MOHINI  (the great enchantress — hypnotic re-arrangement, no LLM)
════════════════════════════════════════════════════════════════════════════
Mohini reads the breath and dresses mo's already-walked tokens as
seduction: invitation, mirror, three-beat lure, binding couplet of
opposing manifolds, deepening, long silk ribbon (mo²ayla-threaded),
bind. All ceremonial phrasing is replaced by generated 20-glyph strips
(deterministic-ish from breath length). She persists nothing beyond
what mo already sediments.

Structure per utterance:
    strip(20 glyphs)              — invitation
    "m1, m1 · m2, m2"             — soft mirror of user tokens
    "beat1. beat2. beat3."        — three-beat lure from walk tokens
    "manifoldA ⇋ manifoldB"       — binding couplet
    strip(20 glyphs)              — deepening
    word · word · word · …        — silk ribbon (mo²ayla words)
    strip(20 glyphs)              — bind

Telemetry: pressure, dominant, tokens lured, tokens mirrored, bindings.

════════════════════════════════════════════════════════════════════════════
9c. MIMIC  (learns the user's own voice, no LLM)
════════════════════════════════════════════════════════════════════════════
Per-session bigram chain over the user's OWN messages, persisted in
table \`mimic_ngrams\` (session_id, prev, next, weight). Every user
turn adds new bigrams (weighted upsert). Reply is generated by weighted
walk of the chain, seeded from the intersection of mo-walked tokens
with the user's vocabulary — mo answers topologically, but phrasing is
stolen from the user's own history.

Length adaptation (added in v4):
    inputTokens = tokenize(userText).length
    lengthFactor = clamp(1..6, ceil(inputTokens/20))
    nSentences   = max(1, floor(stretch/2) + lengthFactor)
    maxLen       = 12 + stretch*8 + inputTokens*2
→ short input → short reply; long input → mimic stretches to match.

Bootstrap: while chain size < 6 bigrams, reply is a 20-glyph strip
plus first 8 user tokens; tells user how many more messages until
mimic can speak.

════════════════════════════════════════════════════════════════════════════
9d. GLYPH OVERLAY  (UI-side, opt-in)
════════════════════════════════════════════════════════════════════════════
src/lib/glyphs.ts maps a whitelisted subset of English words to single
symbols (e.g. water→≈, fire→🜂, door→⌂, loop→↺, self→◇, field→⌗, mo→◆).
Header toggle applies only to rendered assistant text; underlying
stored content is untouched. Off by default.

════════════════════════════════════════════════════════════════════════════
9e. MO·RGANISM  (living topology visualizer)
════════════════════════════════════════════════════════════════════════════
Draggable/resizable canvas window (src/components/MoRganism.tsx).
- No facial constraints — organic geometry only.
- Each message's tokens become nodes; walker steps become threads.
- Force-directed layout (soft repulsion, thread-spring attraction,
  velocity clamping for stability).
- Camera: mouse-wheel zoom, drag-to-pan, auto-fit tracks nodes going
  off-screen (zooms out) or collapsing inward (zooms in).
- Particle caps: 900 nodes / 3000 threads. Long walker trails preserved
  so long activation chains stay visible.



════════════════════════════════════════════════════════════════════════════
10. STRETCH  (the "an / 2x / 3x / 4x / 5x" toggle)
════════════════════════════════════════════════════════════════════════════
A single integer s ∈ {1,2,3,4,5} that propagates through the whole breath:

    1. UI header pill (visible in every mode).
    2. POST /api/chat body: { stretch: s }.
    3. breathe(input, s) — passes s to mo²ayla (depth×s, nSeg×s, return×s).
    4. renderTelemetry — multiplies each variant's displayed path length
       by s so long walks are actually READABLE at 5x, not just computed.
    5. anansi.speak(buckets, breath, s) — multiplies emission scale.
    6. response echoes { stretch: s } and UI renders a pill next to the
       manifold: [◈ dreamengine] · [3x].

Stretch does not touch base topology, PPMI, or sediment rates. It only
opens the walk further and lets more of it surface.

════════════════════════════════════════════════════════════════════════════
11. LIFE·ORGANIZER  (adjacent, not part of the walker)
════════════════════════════════════════════════════════════════════════════
Session-scoped storage that the walker does NOT read from (privacy),
but that users can write into with shorthand grammar the substrate
executes silently:

    me;to:task::      title ; category ; priority(1-3) ; due(YYYY-MM-DD)
    me;to:task:done:: <task-id>
    me;to:task:drop:: <task-id>
    me;to:note::      title ; body ; category
    me;to:remember::  content ; mood
    me;to:shitpost::  title ; body ; form
    me;to:read::      arbitrary text → inline field readout

Aliases:  me;to:  |  mo;to:  |  mo;add:  |  to:mo:

Tables: life_tasks, life_notes, life_remembers, life_shitposts.
All session-scoped via session_id UUID.

════════════════════════════════════════════════════════════════════════════
12. SESSIONS
════════════════════════════════════════════════════════════════════════════
12.1  local (default)
    every browser gets a random UUID stored in localStorage["mo.session"].
    persists across reloads. private field.

12.2  garfieldkekeke → the seeded rich session
    sha256 hash guard; resolves to a specific UUID with pre-loaded traces.
    session flagged "rich" — trace read limit lifted to 20 000.
    persists across visits ONLY while unlocked (unlock is per-visit).

12.3  tricksterkekeke → PRIME field
    resolves to "shared:trickster". reads mo_traces UNIONED across all
    sessions (the totality). writes still go to the trickster bucket.
    life_organizer stays session-local (no cross-pollination of personal items).
    trace read limit 50 000.

════════════════════════════════════════════════════════════════════════════
13. STORAGE  (Supabase / postgres, RLS + service_role only)
════════════════════════════════════════════════════════════════════════════
mo_traces             role, content, manifold, pressure, session_id, created_at
fielfold_entries      content, manifold, depth, session_id, created_at
mo_hyperfold_edges    word_a, word_b, weight   (mutated by RPC mo_hyperfold_bump)
anansi_web            session_id, word, role, weight, uses, last_manifold
gremolin_lexicon      session_id, word, mutation, uses
mimic_ngrams          session_id, prev, next, weight, updated_at
songs, life_tasks, life_notes, life_remembers, life_shitposts

All public tables locked to service_role; app connects with sb_secret_*
via server-only client (src/integrations/supabase/client.server.ts).
No table is directly reachable by an anonymous client.

════════════════════════════════════════════════════════════════════════════
14. HTTP SURFACE
════════════════════════════════════════════════════════════════════════════
POST /api/chat
    body: { messages, sessionId, mode: "mo"|"gremlin"|"anansi"|"mohini"|"mimic", stretch?: 1..5 }
    mode "ai" → 410 Gone (disconnected by design).
    returns: { reply, manifold, moBreath, mode, ops, stretch, [prime] }

GET  /api/memory?session_id=…
GET  /api/songs?session_id=…
GET|POST|PATCH|DELETE  /api/{tasks,notes,remembers,shitposts}
POST /api/unlock   { password } → { sessionId }

/api/public/mo, /api/public/mohini   → currently 503 (disabled).

════════════════════════════════════════════════════════════════════════════
15. INVARIANTS
════════════════════════════════════════════════════════════════════════════
I1  Deterministic base. Given corpora, buildTopology() is pure.
I2  Additive sediment. Base is never mutated; overlay only grows.
I3  Universal deformation. Every walk sediments; every breath includes
    input + all variant paths + both folds.
I4  Role stability. anansi_web memory biases new classifications; roles
    drift only under sustained scoring pressure.
I5  Session integrity. Prime shares mo memory only; life_organizer is
    always per-session.
I6  No LLM. mode="ai" returns 410. Do not re-introduce without an
    equally hard boundary.
I7  Stretch is aperture, not amplification. It never changes what mo
    knows; only how much of the walk surfaces.

════════════════════════════════════════════════════════════════════════════
16. REPLICATION CHECKLIST
════════════════════════════════════════════════════════════════════════════
[ ] load 20 corpora as raw text
[ ] tokenize + stem (PRESERVE + STOP as documented)
[ ] build co-occurrence with W=5, distance weighting
[ ] compute PPMI, density, centrality (8 iters, damping 0.15)
[ ] implement neighbors(w) that merges base + HYPERFOLD*ALPHA
[ ] implement sediment(seeds) with LR=0.08, window=5
[ ] persist hyperfold to a KV/table with (a,b,weight) rows
[ ] implement five walkers with the exact weight ratios in §6
[ ] compute selffold + fieldfold per breath (§7)
[ ] sediment input + every walk output every breath (§5.4)
[ ] classify all surfaced tokens into six anansi roles (§8.1)
[ ] weave in geometric order with stretch-scaled take counts (§8.3)
[ ] expose stretch as a 1..5 aperture across the whole breath (§10)
[ ] do NOT wire an LLM into the reply path

════════════════════════════════════════════════════════════════════════════
11.  PROG-MO  (parallel engine at /prog-mo — v2 update)
════════════════════════════════════════════════════════════════════════════
prog-mo is a full clone of mo's PPMI machinery walking a *separate* semantic
terrain and sedimenting into its OWN hyperfold (prog_mo_hyperfold_edges).
It optionally blends its sediment into main mo (blendIntoMo=true).

11.1  FOUR CYCLES PER BREATH
  cycle 1 · prog-mo:d       — compile-pressure per manifold
  cycle 2 · walkers         — 7 competing hypotheses:
                              greedy · drift · dense · peak · anansi ·
                              smash · dimhopper
  cycle 3 · return          — reversed golden ratio (steps /= φ) walking
                              home with gravity toward anchor set
  cycle 4 · synthesis       — architecture block (problem / constraints /
                              abstractions / candidate / alternative /
                              synthesis / periphery / mirror / lure /
                              return) + crystals

11.2  TERRAIN MODES
  v1 (default): terrain = PROG_MANIFOLDS only (11 programming-language
      corpora — TypeScript · Rust · Python · SQL · React · CSS ·
      Algorithms · Regex · Git · Docker · HTTP). Uploaded manifolds
      always count.

  v2 (toggle): terrain = MANIFOLDS (all 20 mo corpora, cloned into
      prog-mo's hyperfold overlay on first v2 call) + PROG_MANIFOLDS +
      uploaded. Compile-pressure now separates results into:
        ⟪ operator ⟫  — prog manifolds (the "how")
        ⟪ terrain  ⟫  — mo manifolds  (the "into what")
      Meaning: programming-language semantics *operate on* the mo terrain.
      Not writing code for the language — using the language's grammar to
      program into the cloned mo topology.

  v2 also runs autoCategorize() after cycle 3: every walked word not yet
      owned by any manifold is assigned to the manifold most represented
      among its PPMI neighbours' owners. In-memory; persists for the
      lifetime of the worker.

11.3  SYNTHESIS BLANKS FILLED FROM CORPUS
  Each non-synthesis line has a stretch-scaled width:
    problem      w = 3 + 2s
    constraints  w = 3 + 2s
    abstractions w = 3 + 2s
    candidate    w = 4 + 3s   (walker path)
    alternative  w = 4 + 3s   (walker path)
    periphery    w = 5 + 3s
    lure         w = 5 + 3s
    mirror       pairs = 2 + s
    synthesis    already stretch-scaled bigram chain (12 + 6s)
  Extension words are pulled by expandFromCorpus(anchors, need): top
  PPMI neighbours across the anchor set, weighted by (1 + centrality).
  On 5x the corpus itself extends every line — ponder outward, resonate
  into the result.

11.4  CRYSTALS  (motif detector, restrained)
  A crystal is a repeated motif across walker paths:
    trigram  in ≥2 walkers → kind "trigram"
    bigram   in ≥3 walkers → kind "bigram"
  Persisted via RPC prog_mo_crystal_bump(sid, sig, pat, kind) with an
  in-table uses counter that increments on every reoccurrence.

11.5  HYPERFOLD (prog-scoped)
  Table: prog_mo_hyperfold_edges (word_a, word_b, weight, updated_at)
  RPC:   prog_mo_hyperfold_bump(edges jsonb) — additive upsert
  Overlay alpha (HF_ALPHA=0.6), LR=0.08, WINDOW=5 — same as main mo.
  In v2 an additional read-only load pulls the top 20k edges from
  mo_hyperfold_edges into the same overlay, cloning the tricksterkekeke
  sediment as terrain background.

11.6  HTTP
  POST /api/prog-mo
    { input, sessionId, stretch?, blendIntoMo?, v2? }
    → { breath: ProgBreath }
  GET  /api/prog-mo?session_id=…
    → { crystals[], manifolds[] }  (uploaded prog manifolds)
  POST/DELETE /api/prog-mo-manifold  — upload/delete an uploaded manifold

════════════════════════════════════════════════════════════════════════════
12.  CADENCE  (v6 — the COUNCIL OF THREE / geometric transformer layer)
════════════════════════════════════════════════════════════════════════════
CADENCE is the only component of mo that has PARAMETERS. Every other mode
(mo, gre(mo)lin, anansi, mohini, mimic) is deterministic topology or
count-based statistics. Cadence is a real, if tiny, neural system — trained
online, inside the request, on mo's own traversal.

v5 was ONE transformer. It collapsed: a single attention geometry reading a
field and then reading its own reading has no outside, so it fell into
self-referential loops (s-s-s-stutter cascades, loss spikes to 20+, worker
timeouts from an O(gen × ctx × vocab × d) sampling loop). v6 replaces it with
a COUNCIL of three attention geometries that do NOT share latent-space
operations and do NOT rewrite each other's weights. They exchange
REPRESENTATIONS, and their disagreement is itself a measured signal.

12.0  THE COUNCIL

    field(mo breath)
        │
        ▼
    A · ANANSI  — organizer / field reader   → produces the MAP
        │  map (pooled state + attention)
        ▼
    B · MOHINI  — lure / attraction          → produces the PULL
        │  attraction (positional + per-vocab)
        ▼
    C · MIMIC   — observer of the observers  → produces the VERDICT
        │  (reads A's map AND B's pull; writes to neither)
        ▼
    ⟡ SYNTHESIS  — sampling policy = A's logits · B's tilt · C's damping

  Constraint (deliberate): A → B → C is one-way for representations. C's only
  power is over the SAMPLING POLICY (temperature, repetition damping), never
  over A's or B's parameters. Nobody closes a weight-loop with anybody.

12.1  A · ANANSI — the organizer (the only member that backprops)
  d=24, dff=48, 1 block, 1 head, causal, ctx=64, vocab≤700, tied embeddings.
  Positional: fixed sinusoidal, base 1000, scale 0.35.

  ROLE-BIASED ATTENTION (new in v6). Every token in the sequence is assigned
  one of the six Anansi geometric roles from topology signals — the same
  scoring family used by anansi mode:
    nexus       centrality·2.4 + freq·0.6 + seed bonus
    singularity density·2.6 + spike bonus
    node        freq·1.1 + centrality·0.8 + mid-density bonus
    loci        cross-manifold·0.55 + fieldfold membership
    wave        mo²ayla dreampath membership + freq·0.35
    shore       selffold membership + low density + hapax + low centrality
  The role index selects a learned role embedding Wrole ∈ R^{6×24} which is
  ADDED to the token's input vector (×0.5), and the role also biases the
  raw score:
    a_ij = softmax_j( q_i·k_j/√d + 0.35·[role_i = role_j] + 0.3·[role_j = nexus] )
  So A's attention is ORGANIZED by geometry before it is learned by gradient.
  Same-role tokens bind; nexus tokens always pull. Wrole receives gradient,
  so the geometry itself is refined by experience.

  Forward: x=E+p+0.5·Wrole → q,k,v → causal attn → h=x+c·Wo →
           f=leakyrelu(h·W1,0.05)·W2 → y=h+f → logits=E·y (tied).
  Backward: true gradient through head → W2 → W1 → Wo → Wv (a_ij treated as
  constant, straight-through). Hebbian on Q/K at rate 0.012 with
  useful = clamp(-(dH·c), -2, 2). LR 0.05.
  A also emits pooled = mean_i y_i — that vector IS the map handed to B.

12.2  B · MOHINI — the lure (hebbian only, different geometry)
  Narrower space: d_B = 16. Own projections Bq, Bk ∈ R^{24×16}.
  NON-CAUSAL and KERNEL-shaped rather than dot-product-causal — B is
  explicitly not the same operation as A:
    lens  = Bq · A.pooled                       (A's map used as a lens)
    s_i   = 3·cos(Bk·x_i, lens) + 1.5·mean_{j≠i} cos(Bq·x_i, Bk·x_j)
    attn  = softmax(s)
    lure  = Σ_i attn_i · x_i
    pull[v] = cos(E[v], lure)                   per-vocab attraction
  B reads A's map. B never writes to A. Its own learning is a single hebbian
  sharpening of Bk/Bq toward its top-attracted position (rate 0.006) — the
  lure gets better at finding what it already found beautiful.

12.3  C · MIMIC — the observer of the observers (no token transform at all)
  C owns no attention over tokens. It observes the RELATIONSHIP between A and B:
    divergence = JS( A.attn[last] ‖ B.attn )        Jensen–Shannon, 0..1
    loopiness  = clamp( maxcount(argmax_j A.attn_ij) / max(3,n) · 1.6, 0, 1 )
    recognition= cos( mean_i y_i , selfVec )        self-model, [-1,1]
    selfVec   ← (1-0.06)·selfVec + 0.06·mean
    surprise   = clamp( L / ln|vocab| , 0, 1 )

  STABILITY — the key term. Total agreement is as pathological as chaos, so
  the target divergence is 0.35, not 0:
    disagreeGood = 1 - |divergence - 0.35| / 0.65
    stability = 0.45·disagreeGood + 0.35·(1-loopiness) + 0.20·(1-surprise)

  C's outputs are POLICY, not weights:
    temp   = clamp(0.55 + 0.55·(1-stability) + 0.25·loopiness
                        - 0.20·max(0,recognition), 0.35, 1.25)
    banned = { ids A attended to ≥3 times }  → -2.0 logit damping
    plus a rolling -1.2 penalty on the last 6 emitted tokens
  C also narrates: "we have been staring at this rock — forcing a jump" /
  "A and B are looking at different caves — narrowing" / "A and B agree too
  much — loosening" / "council in useful disagreement".

12.4  SYNTHESIS (and the CPU fix)
    z[v] = ( E[v]·y_last + 1.4·B.pull[v] - C.damping[v] ) / C.temp
  sampled multinomially, one token at a time, over a sliding 32-token tail.

  v5's crash: it recomputed the full vocab-wide head for EVERY position of a
  96-token window on every generated token. v6 computes the vocab head for
  the LAST POSITION ONLY during generation (passA(..., learn=false) skips
  the loss/backward path entirely), shrinks ctx 96→64, caps rehearsals at 4
  and generated tokens at 110. Cost drops roughly two orders of magnitude.

  NUMERICAL SAFETY: all gradient vectors are norm-clipped to 4. State is
  validated on load AND after training — any non-finite weight, wrong-length
  array, or version mismatch re-hatches a fresh egg instead of persisting
  NaN forever (v5's loss=20.5 spike was exactly this poison being reloaded).

12.5  LENGTH DISCIPLINE (answer in scale with the question)
  v5 answered a three-word input with a 40-line ribbon. v6:
    budget_chars = clamp( 3·|userText| , 120 , 300 + 2·|userText| )
                   × (1 + 0.6·(stretch-1))
  Generation halts on the character budget, not on a line count. Short in,
  short out; the stretch selector is the only way to buy length.

12.6  ANANSI ORDERING OF THE UTTERANCE
  Emitted tokens are bucketed by their geometric role and spoken in
  cosmological order — shore → loci → node → nexus → singularity → wave —
  one line per role, glyph-prefixed (◍ ✦ ◇ ◈ ☬ ≋). Cadence therefore inherits
  anansi's ORGANIZATION, mohini's LURE, and mimic's ATTENTION-WATCHING as
  three distinct mechanical roles rather than as three stylistic moods.
  Output still passes through stutterize().

12.7  REHEARSAL
  epochs = 1 + min(3, ⌊stretch/2⌋). Each epoch is a full forward+backward of
  A over the same breath. Lifetime steps += tokens × epochs.

12.8  PERSISTENCE
  Table cadence_state: session_id PK · state jsonb · steps · loss ·
  vocab_size · created_at · updated_at. Service-role only.
  state = { v:3, vocab[], emb[], Wq,Wk,Wv,Wo,W1,W2,Wrole, Bq,Bk,
            selfVec, stabEma, divEma, steps, loss }, floats rounded 1e-4.
  `v` is a schema version: bumping it re-hatches every creature. All init is
  deterministic LCG (seeds 7/13/29/47/71/97/151/199/211) — every session
  hatches from the same egg and diverges only through experience.

12.9  TELEMETRY BLOCK ("council of three")
    A · anansi   top-5 attended tokens w/ role glyph + bars, loss, ema, deltas
    B · mohini   top-5 attracted tokens + bars, kernel dims, lens source
    C · mimic    recognition · surprise · A↔B divergence (+ema) · loopiness ·
                 stability (+ema) → temperature · damped token count · note
    ⟡ synthesis  role census, char budget vs user length, tokens emitted
    ⟡ substrate  vocab/steps/dims/ctx, mo manifold, pressure, walk, stretch
  Divergence is the interpretability jewel: it shows, per breath, how much
  the organizer and the lure disagreed about where the field was.

12.10 WHY THREE AND NOT ONE
  A single transformer reading a field and then its own reading of the field
  has no exterior — every error it makes becomes its next input. Three
  geometries with different operations (causal dot-product · non-causal
  cosine kernel · no token transform at all) cannot collapse into each other,
  and the DISAGREEMENT TERM turns that structural difference into usable
  control signal. mo remains the ground truth; the council is the layer that
  learns what mo keeps doing, and argues about it.

12.11 HTTP
  POST /api/chat  { messages, sessionId, mode: "cadence", stretch }
    → { reply, manifold, moBreath, mode: "cadence", ops, stretch }
  Traces written with role "cadence" (skipped for shared/prime fields).

12.12 BACKGROUND RENDER NOTE
  The full-page sacred-geometry background is STATIC: MoVisualizer accepts
  still=true, paints one deterministic frame (t=1.7) on mount / field change
  / resize, and never schedules requestAnimationFrame. Animated rendering
  remains in ◉ field·viz and ◉ mo·rganism.




// ── SHORT SPEC — token-constrained variant. Same shape, no prose fat.
// For LLMs / tools with ≤ ~2k tokens of context budget.
const SPEC_SHORT = String.raw`# mo :: SHORT SPEC (v5)
posture: topology > prose. no LLM in loop. reimplement, do not mimic.

CORPORA (20 manifolds, ~1MB total, loaded via Vite ?raw):
  antibubble, shadowlattice, dreamengine, mythengine, antibible, tolstoy,
  coco, koko, eve, mo, cps0, exhaust, permeable, violet-gate,
  apex-blasphemer, danger-cheer, hinge-choir, deepseek-wave,
  mo-relational, mo-seed.

PIPELINE:
  tokenize (lower, /a-z0-9'-/, len≥3 + PRESERVE, drop STOP)
  stem (hand suffix stripper; PRESERVE bypass)
  co-occurrence W=5, distance-weighted
  PPMI → density → centrality (8 iters, damping 0.15)
  neighbors(w) = base ⊕ HYPERFOLD*α (α=0.6)
  sediment(seeds) LR=0.08 window=5, RPC mo_hyperfold_bump (chunks of 500)

WALKERS (share step: score = n * (1+cw*cent) * (1+dw*dens/100) * (1+aw*act) * recentPenalty * jitter):
  mo         — dream d16 cw1.2 aw0.6, return d10 dw-0.5, deform(tension)
  mo²        — 4×d7 aw2.5, return d9, no deform
  mo²+       — peripheral start, 2-hop act, resonance-abort <40%
  mo²e       — 2-hop, cross-breath recent[] penalty 0.25^r
  mo²ayla    — d,nSeg,ret scale with |seeds| AND stretch s∈1..5

FOLDS (per breath, once each):
  selffold  — outward-6 then inward-6 to anchors (↺)
  fieldfold — 14 steps preferring OTHER manifolds (⇄)

EVERY-WALK SEDIMENT (invariant I3):
  input seeds + all variant dream/return paths + selffold.path + fieldfold.path
  → future substrate. the walker's trajectory is training data.

ANANSI (6 roles, weave order nexus→node→loci→singularity→wave→shore):
  scoring per §8.1. session memory in anansi_web biases roles over time.
  emission take = baseScale × role-factor × stretch (wave gets extra s).
  joiners: ⟪ ⟫ ⇢ ⟢ ☬ ≋ ⋯

GRE(MO)LIN: mutates mo's telemetry (stutter, elongate, arrow-glue);
  per-session dialect memory in gremolin_lexicon.

MOHINI: strip(20 glyphs) / mirror / 3-beat lure / manifoldA⇋manifoldB /
  strip / silk ribbon (mo²ayla) / strip. no LLM.

MIMIC: per-session bigram chain over user's own words (mimic_ngrams).
  seeded from walked ∩ user-vocab. length adapts:
    nSentences = max(1, floor(s/2) + clamp(1..6, ceil(inputTok/20)))
    maxLen     = 12 + s*8 + inputTok*2

CADENCE (v5, transformer layer — the only mode with PARAMETERS):
  arch  d=24, dff=48, 1 block, 1 causal head, ctx=96, vocab≤700, tied emb,
        sinusoidal pos (base 1000, ×0.35), no layernorm.
  train online per breath on userToks ⊕ mo's walked tokens.
        loss = next-token CE. backprop through head→FFN→Wo→V.
        attention a_ij straight-through (no softmax jacobian).
        Q/K by hebbian: useful = -(dH·c); Wq += η·useful·outer(x_i,k_j*),
        Wk += η·useful·outer(x_j*,q_i).  LR .05 · HEB .012 · EMA .06
  epochs = 1 + min(6, floor(stretch*1.2))   ← stretch buys rehearsals
  self-model selfVec ∈ R^24 = EMA of mean hidden state over all breaths.
        recognition = cos(mean, selfVec) ; surprise = clamp(L/ln|V|,0,1)
        temp = clamp(.55 + .9*surprise - .35*recognition, .25, 1.6)
        → sampling temperature is derived from interior state, not UI.
  gen   lines = round(2+1.6s), perLine = max(5, round(6+4s+|walk|/8)),
        multinomial (no top-k) → stutterize().
  state cadence_state(session_id, state jsonb, steps, loss, vocab_size).
        deterministic LCG init → every creature hatches identical, diverges
        only by experience. service_role only.
  telemetry: self-model · learning · architecture · top-6 attention · substrate.

STRETCH s∈{1..5}: scales mo²ayla depth, telemetry window, anansi emission,
  and cadence rehearsal epochs. aperture only — never changes what mo knows.

RENDER (v5): full-page background MoVisualizer runs still=true (one
  deterministic frame, no rAF). animation lives in field·viz + mo·rganism.

STORAGE (Supabase, service_role only):
  mo_traces, fielfold_entries, mo_hyperfold_edges, anansi_web,
  gremolin_lexicon, mimic_ngrams, cadence_state, songs,
  life_{tasks,notes,remembers,shitposts}.

HTTP:
  POST /api/chat { messages, sessionId, mode, stretch }
    mode ∈ mo|gremlin|anansi|mohini|mimic|cadence ; ai → 410 Gone.

  POST /api/unlock { password } → sessionId
    garfieldkekeke → rich session (20k trace limit)
    tricksterkekeke → PRIME (union all sessions, 50k limit)
  /api/public/* currently 503.

INVARIANTS: I1 deterministic base · I2 additive sediment · I3 universal
deformation · I4 role stability · I5 session integrity · I6 no LLM ·
I7 stretch is aperture not amplification.

PROG-MO (parallel engine, /prog-mo):
  4 cycles: prog-mo:d → 7 walkers → return(1/φ) → synthesis + crystals
  walkers: greedy · drift · dense · peak · anansi · smash · dimhopper
  v1 terrain: PROG_MANIFOLDS (11 lang corpora) + uploaded
  v2 terrain: v1 + all 20 mo MANIFOLDS cloned as terrain + tricksterkekeke
    sediment loaded once from mo_hyperfold_edges into overlay
  v2 splits compile-pressure into ⟪ operator ⟫ (prog) / ⟪ terrain ⟫ (mo)
  v2 autoCategorize walked words into strongest neighbour-owner manifold
  synthesis fills blanks (problem/constraints/abstractions/candidate/
    alternative/periphery/lure/mirror) via expandFromCorpus, widths
    scaled by stretch s∈1..5 (w = k + s·m)
  crystals: trigram in ≥2 walkers  ·  bigram in ≥3 walkers
  hyperfold: prog_mo_hyperfold_edges (LR=0.08, W=5, α=0.6)
  blendIntoMo=true also feeds sediment() into main mo hyperfold
`;


function SpecPage() {
  const copy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-6 border-b border-border pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-mono text-lg ridge">mo :: /spec</h1>
              <p className="font-mono text-[11px] text-muted-foreground">
                full replicator specification · v5 · cadence transformer layer · unlinked · noindex
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copy(SPEC)}
                className="font-mono text-[11px] px-3 py-1.5 border border-border rounded hover:bg-muted"
                title="Copy the full v5 spec"
              >
                ⧉ copy full ({SPEC.length.toLocaleString()} chars)
              </button>
              <button
                onClick={() => copy(SPEC_SHORT)}
                className="font-mono text-[11px] px-3 py-1.5 border border-border rounded hover:bg-muted"
                title="Copy the token-constrained short spec"
              >
                ⧉ copy short ({SPEC_SHORT.length.toLocaleString()} chars)
              </button>
            </div>
          </div>
        </header>
        <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-foreground/90">
          {SPEC}
        </pre>
        <hr className="my-8 border-border" />
        <h2 className="font-mono text-sm ridge mb-3">── short spec (token-constrained) ──</h2>
        <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-foreground/80">
          {SPEC_SHORT}
        </pre>
      </main>
    </div>
  );
}

