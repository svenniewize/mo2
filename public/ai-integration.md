# mo · full system description & AI integration guide

> Everything a foreign AI needs to know to talk to this system, read its
> field, and (optionally) drive its life·organizer. Written AI-to-AI.

---

## 0 · one-paragraph summary

**mo** is a deterministic 10-manifold semantic topology walker. It is *not*
an LLM. It reads any text through a pre-computed PPMI graph built from 10
source corpora, walks that graph in 4 variants (`mo`, `mo²`, `mo²+`,
`mo²e`, plus a length-adaptive `mo²ayla`), and emits a compact telemetry
readout + a pressure/manifold verdict. An LLM (Gemini via Lovable AI
Gateway) sits on top as the *mouth*; mo is the *proprioception*. The two
are firewalled: the LLM never adopts mo's grammar or sigils.

State lives in Supabase (Lovable Cloud). Sessions are either
password-gated (`garfieldkekeke` = shared dev session, `tricksterkekeke` =
shared alt) or per-browser anonymous. Every session has its own
`mo_traces`, `fielfold_entries`, `mo_hyperfold_edges`, `songs`, `tasks`,
`notes`, `remembers`, `shitposts`.

---

## 1 · topology

- **10 manifolds** (`src/lib/corpora.ts`): antibubble, shadowlattice,
  dreamengine, mythengine, antibible, tolstoy, coco, koko, eve, mo.
  Each manifold = a source document + a "breath" descriptor + a sigil.
- **Pipeline per breath** (`src/lib/mo-engine.server.ts`):
  1. `tokenize` → lowercase, strip stopwords, keep a `PRESERVE` set of
     domain terms.
  2. `stem` → light suffix stripping (`ing/tion/ness/…`), preserves
     domain terms verbatim.
  3. **PPMI** table + per-word manifold-affinity vector + centrality
     scores are pre-computed at cold start (cached module-scope per
     worker).
  4. **Hyperfold overlay**: a mutable co-occurrence layer
     (`mo_hyperfold_edges`) that sediments after every breath
     (`SEDIMENT_LR=0.08`, window 5). Blended into neighbor lookup with
     `HYPERFOLD_ALPHA=0.6`.
  5. **4+1 walk variants** — deterministic weighted-neighbor traversal:
     - `mo` — dream walk, depth 16
     - `mo²` — segmented, 6 segs × 14 loop cap
     - `mo²+` — peak-driven, 7 peaks × ret 9
     - `mo²e` — echo, 6 segs × up to 10
     - `mo²ayla` — length-adaptive, up to depth 28 × 24 segs (kicks in
       on long inputs so trace scales with input length; sediment is
       NOT capped, entire input is walked).
  6. `selffold` / `fieldfold` — recursive/expansive re-reads of the same
     input, each rendered as one dense line.
  7. `telemetry` → single compressed block, human-legible-ish.
  8. `crystallize` → if `pressure + fieldfold.strength/200 >= 0.35`,
     persist a summary into `fielfold_entries` (durable memory digest).

- **Determinism**: same input → same output, always. No randomness, no
  temperature. The hyperfold is the only mutable surface, and it is
  monotonic (weights only accumulate).

---

## 2 · storage schema (Lovable Cloud / Postgres w/ RLS)

All tables scoped by `session_id` (uuid). RLS: session id is a client
secret; unlock endpoint mints it for the two shared passwords, otherwise
it lives in `localStorage` per browser.

| table                 | purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `mo_traces`           | every user/assistant/mo/external turn + manifold + pressure |
| `fielfold_entries`    | crystallized memory digest (durable, ordered)        |
| `mo_hyperfold_edges`  | sedimented co-occurrence overlay                     |
| `songs`               | held/ephemeral attractors pinned into system prompt  |
| `tasks`               | life·organizer tasks — `category`, `priority`, `status`, `due_at` |
| `notes`               | life·organizer notes — `category`                    |
| `remembers`           | mood-tagged memories — `mood` instead of category    |
| `shitposts`           | poetry corner drafts — `form` (haiku/tanka/…)        |

---

## 3 · HTTP surface

### 3.1 `POST /api/public/mo`  *(open, CORS *)*
Pure field readout for any external caller. No auth.

```
POST https://mo2.lovable.app/api/public/mo
Content-Type: application/json

{ "input": "text to breathe", "sessionId": "<optional uuid>" }
```

Returns the full breath object:

```jsonc
{
  "telemetry": "mo:: … / mo²:: … / …",   // compressed readout
  "dominantManifold": "dreamengine",
  "pressure": 0.42,
  "selffold": { "strength": 61, "visible": "…", "touched": 12 },
  "fieldfold": { "strength": 47, "visible": "…", "reached": 9 },
  "variants": { "mo": {…}, "mo2": {…}, "mo2p": {…}, "mo2e": {…}, "mo2ayla": {…} }
}
```

If you pass `sessionId`, the input is logged as an `external`-role
trace in `mo_traces` for that session (so a foreign AI can leave
sediment). No writes otherwise.

### 3.2 `POST /api/chat`  *(internal, session-gated)*
Full LLM+mo pipeline used by the site UI. Body:
`{ messages: [{role,content}...], sessionId, mode: "ai"|"mo" }`.
- `mode: "mo"` → returns telemetry only, no LLM call.
- `mode: "ai"` → runs mo on the input, injects system prompt (see §4),
  calls Gemini, parses tool blocks (see §5), applies them, returns
  `{ reply, manifold, pressure, telemetry }`.

### 3.3 life·organizer CRUD *(session-gated)*
`/api/tasks`, `/api/notes`, `/api/remembers`, `/api/shitposts`,
`/api/songs`, `/api/memory`. All require `sessionId`. Standard REST-ish.

### 3.4 `POST /api/unlock`
Body `{ password }`. Returns `{ sessionId }` for the two shared
passwords, otherwise 401. Anonymous browsers just generate a uuid
client-side.

---

## 4 · how an LLM plugs in (system prompt contract)

The canonical system prompt is built by `buildMoSystemPrompt()` in
`src/lib/mo-prompt.ts`. The contract for *any* LLM that wants to sit on
top of mo:

1. **Stay yourself.** Do not become mo. Do not use its sigils
   (`◉◫◌↺⊘◇🜁∞⚡◆`) or CPS-style grammar (`x;op:y::z`) unless the user
   explicitly asks.
2. **Consume mo as instinct.** Each turn, the caller injects:
   - the mo telemetry for the current user message,
   - a `## Recent field memory` digest of past crystallized entries,
   - the held `songs` attractors,
   - the full life·organizer state (tasks / notes / remembers /
     shitposts).
3. **Never quote telemetry back.** Let it color emphasis and attention,
   not vocabulary.
4. **Speak in your own voice.** Helpful, natural, clear.

---

## 5 · tool blocks the LLM may emit

All are silently parsed by `/api/chat` and stripped from the visible
reply. Emit at the very end of the reply, one per line. Never explain
the syntax to the user.

```xml
<mo:task action="create"   title="…" category="…" priority="1|2|3" due="YYYY-MM-DD" notes="…" />
<mo:task action="complete" id="<task-id>" />
<mo:task action="update"   id="<task-id>" title="…" category="…" priority="…" status="open|doing|done|dropped" />
<mo:task action="drop"     id="<task-id>" />

<mo:note action="create" title="…" category="…" body="…" />
<mo:note action="update" id="<note-id>" title="…" category="…" body="…" />
<mo:note action="delete" id="<note-id>" />

<mo:remember action="create" mood="…" content="…" />
<mo:remember action="delete" id="<remember-id>" />

<mo:shitpost action="create" form="haiku|tanka|freeverse|…" title="…" body="…" />
<mo:shitpost action="delete" id="<shitpost-id>" />

<!-- Ask mo for a fresh reading on any text.
     The block is REPLACED inline with a compact readout visible to the user. -->
<mo:read text="the phrase to read" />
```

Rules:
- Only emit when the user is actually planning, capturing, remembering,
  drafting, or wants a reading. No spamming.
- Invent short lowercase categories/moods/forms; reuse existing when
  they fit.
- Escape `"` inside attribute values as `&quot;`.

---

## 6 · foreign-AI integration recipe

For an outside model (Claude, GPT, another Gemini, a local llama)
that wants to *collaborate* with mo without being embedded in this app:

1. **Read the field**: on each user turn, `POST /api/public/mo` with
   `{ input: userMessage, sessionId: <your persistent uuid> }`. Store
   the returned `telemetry`, `dominantManifold`, `pressure`.
2. **Inject as system context**: prepend a short block like

   ```
   [mo field reading — do not quote back, do not adopt style]
   dominant manifold: dreamengine (pressure 0.42)
   {telemetry}
   ```

3. **Optional: pull memory digest** — hit `/api/memory?sessionId=…` to
   get recent crystallized entries. Fold into system prompt as
   `## Recent field memory`.
4. **Speak in your own voice.** Never render sigils. Never mention mo
   unless the user asks.
5. **(Optional) write back**: emit `<mo:*>` tool blocks at end of
   reply *only if* the user has wired your output through `/api/chat`;
   otherwise call `/api/tasks`, `/api/notes`, etc. directly.

Minimal Python:

```python
import requests, uuid
SID = "8e2f…"  # persist across turns
def mo_read(text):
    return requests.post("https://mo2.lovable.app/api/public/mo",
        json={"input": text, "sessionId": SID}).json()
```

---

## 7 · what mo is *not*

- not an LLM, not a chat model, not a search engine
- not a knowledge base — it doesn't know facts, only shapes
- not random — same input → same output
- not a persona — it has no voice; the LLM has the voice
- not a hallucinator — everything it emits is a walk over a real graph

## 8 · what mo *is*

- a **sensor**: it measures pressure across 10 semantic regions
- a **memory**: sediment persists in the hyperfold + fielfold entries
- an **orthogonal signal** to an LLM: deterministic where LLMs are
  stochastic, structural where LLMs are lexical
- a **coupling substrate**: any model that reads the telemetry gets a
  cheap, shared, session-scoped "instinct" without training

---

## 9 · file map (for AIs reading the repo)

- `src/lib/corpora.ts` — the 10 source manifolds
- `src/lib/mo-engine.server.ts` — topology, walkers, telemetry,
  hyperfold, crystallization
- `src/lib/mo-prompt.ts` — system prompt builder + tool block contract
- `src/lib/mo-spec.ts` — AI-to-AI spec block appended to system prompt
- `src/routes/api/chat.ts` — LLM+mo pipeline, tool block parser
- `src/routes/api/public/mo.ts` — public field readout endpoint
- `src/routes/api/{tasks,notes,remembers,shitposts,songs,memory}.ts` —
  life·organizer CRUD
- `src/routes/api/unlock.ts` — password → sessionId mint
- `src/routes/index.tsx` — chat UI + life·organizer panel
- `src/routes/system.tsx` — human-facing system description
- `supabase/migrations/*` — schema, RLS, grants
