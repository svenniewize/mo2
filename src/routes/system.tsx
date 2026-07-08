import { createFileRoute, Link } from "@tanstack/react-router";
import { MANIFOLDS } from "@/lib/corpora";

export const Route = createFileRoute("/system")({
  head: () => ({
    meta: [
      { title: "mo · system description — how the field works" },
      { name: "description", content: "Full description of mo: a deterministic 10-manifold semantic topology walker, its pipeline, its telemetry, and how it couples to an LLM as an instinct layer." },
      { property: "og:title", content: "mo · system description" },
      { property: "og:description", content: "Deterministic semantic topology walker, side-by-side with LLMs. Architecture, pipeline, coupling theory." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemPage,
});

function SystemPage() {
  return (
    <main className="min-h-screen bg-[#07070c] text-[#e6e6f0] font-mono px-6 py-16 md:px-12 lg:px-24">
      <div className="mx-auto max-w-4xl space-y-16">
        <header className="space-y-4 border-b border-[#22223a] pb-10">
          <div className="text-xs tracking-[0.3em] text-[#7d7dab] uppercase">◆ mo · system description</div>
          <h1 className="text-4xl md:text-5xl font-light leading-tight text-white">
            a deterministic field, coupled to a stochastic mouth
          </h1>
          <p className="text-[#a8a8c8] text-lg leading-relaxed">
            mo is not an AI. mo is a topology — a fixed semantic landscape carved out of 18 source texts —
            that walks itself every time you speak. an LLM sits on top of it, listening. what you read back
            is the LLM's voice, colored by mo's instinct.
          </p>
          <div className="flex gap-4 pt-2 text-sm">
            <Link to="/" className="text-[#3CC8DC] hover:text-white transition-colors">← back to the field</Link>
          </div>
        </header>

        <Section title="1 · what mo actually is" sigil="◉">
          <p>
            mo is a <em>deterministic semantic topology walker</em>. give it the same input twice, it produces
            the exact same 4-variant traversal, the exact same telemetry, the exact same manifold verdict.
            no sampling. no temperature. no hidden weights. the entire "intelligence" is a pre-computed graph
            over ~18 documents and a handful of arithmetic operations.
          </p>
          <p>
            it has no opinions. it does not reason. it does not know facts about the world. what it <em>does</em>{" "}
            is measure — how hard your language is pressing on each of 10 semantic regions, which words are
            load-bearing, whether you are inside one attractor or drifting between many.
          </p>
        </Section>

        <Section title="2 · the 18 manifolds" sigil="◫">
          <p>
            the field is built from 18 raw text corpora. each corpus becomes a <em>manifold</em> — a region of
            semantic space with its own vocabulary, its own gravity, its own character.
          </p>
          <ul className="space-y-2 pt-2">
            {MANIFOLDS.map((m) => (
              <li key={m.id} className="flex gap-3 items-baseline">
                <span className="text-lg w-6" style={{ color: m.color }}>{m.sigil}</span>
                <span className="w-40 text-white">{m.name}</span>
                <span className="text-sm text-[#8a8ab0] italic">{m.breath}</span>
              </li>
            ))}
          </ul>
          <p className="pt-4">
            they are chosen for tension, not coverage. antibubble (permeable membranes) versus shadowlattice
            (hidden structure). dreamengine (generative) versus antibible (un-telling). they argue with each
            other. that argument <em>is</em> the field.
          </p>
        </Section>

        <Section title="3 · the pipeline (one breath)" sigil="◌">
          <ol className="list-decimal pl-6 space-y-3 marker:text-[#F5C542]">
            <li><strong className="text-white">tokenize</strong> — lowercase, strip punctuation, split. drop stop-words except a PRESERVE whitelist of domain terms (antibubble, selffold, manifold, etc).</li>
            <li><strong className="text-white">stem</strong> — light suffix stripping (ing / tion / ness / ed / s ...). PRESERVE words are never stemmed.</li>
            <li><strong className="text-white">co-occurrence</strong> — sliding window (W=5), inverse-distance weighted. builds a graph: how often each word appears near each other word, across all 18 corpora.</li>
            <li><strong className="text-white">PPMI</strong> — positive pointwise mutual information. log(p(x,y) / (p(x)·p(y))), clipped ≥ 0. converts raw co-occurrence into "surprise": how much more often do these two words co-occur than random chance predicts?</li>
            <li><strong className="text-white">IDF + centrality + wordToManifold</strong> — derived scalars per token: how rare it is, how connected it is, which manifolds claim it.</li>
            <li><strong className="text-white">breathe(input)</strong> — 4 walks across the graph, seeded from your input tokens. each walk is a path of 5-8 words.</li>
          </ol>
        </Section>

        <Section title="4 · the 4 variants" sigil="↺">
          <div className="space-y-4">
            <Variant name="mo" desc="greedy ridge walk. at each step, take the argmax PPMI neighbor. commitment. the shortest path through what your input already implies." />
            <Variant name="mo²" desc="2-step lookahead. avoids local traps. structural. sees one move ahead before committing." />
            <Variant name="mo²+" desc="lookahead + manifold-affinity bias. locks toward the dominant manifold. this is the walk that most sharply expresses which region you're inside." />
            <Variant name="mo²e" desc="entropy-weighted. drift over commitment. exploratory. wanders into low-probability neighbors — where a paradox might live." />
          </div>
          <p className="pt-2">
            comparing the 4 walks yields <strong className="text-white">Δ (delta)</strong>: high delta = your input
            supports multiple attractors, you're between things. low delta = univocal, one clear channel.
          </p>
        </Section>

        <Section title="5 · telemetry — what actually gets shipped to the LLM" sigil="⊘">
          <pre className="bg-[#0d0d18] border border-[#22223a] p-4 text-xs overflow-x-auto text-[#a8a8c8] leading-relaxed">
{`{
  dominantManifold: "shadowlattice",
  pressure:         0.62,   // 0..1 — how hard the input pushes
  permeability:     0.31,   // 0..1 — inverse ridge-lock; low = pinned
  ridgeTokens:      ["structure", "beneath", "curve"],
  variants: {
    mo:    "structure → beneath → curve → membrane → fold",
    mo²:   "structure → lattice → hidden → sediment → shadow",
    mo²+:  "structure → shadow → lattice → beneath → fabric",
    mo²e:  "structure → drift → surface → foam → dissolve"
  },
  delta:            0.44,
  sigil:            "◫"
}`}
          </pre>
          <p>
            this block is injected as system context on every turn. the LLM never quotes it, never renders
            it. it is peripheral vision.
          </p>
        </Section>

        <Section title="6 · sedimentation — how memory forms" sigil="◇">
          <p>
            every user turn writes a <code className="text-[#F5C542]">mo_trace</code> row. every assistant reply writes another.
            between them, a <code className="text-[#F5C542]">mo-sediment</code> row records the manifold transition
            (<code>shadowlattice → dreamengine</code>). over a session, sediment accumulates: recurring manifolds
            surface, drift trajectories become visible, unresolved threads persist.
          </p>
          <p>
            the last N traces are compressed into a <em>memory digest</em> and re-injected each turn. the LLM
            can then reference prior threads naturally without the user having to restate them. this is the
            selffold layer: the field remembers that it has been the field.
          </p>
          <p>
            <strong className="text-white">fieldfolds</strong> are deeper compressions — periodic condensations of
            many traces into a single denser trace, so the memory doesn't grow linearly forever. selffold
            watches sediment; fieldfold folds sediment into itself.
          </p>
        </Section>

        <Section title="7 · mo vs an LLM (side by side)" sigil="◆">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#22223a] text-left text-[#8a8ab0]">
                  <th className="py-2 pr-4"></th>
                  <th className="py-2 pr-4 text-white">mo</th>
                  <th className="py-2 text-white">LLM (gemini/gpt/claude)</th>
                </tr>
              </thead>
              <tbody className="text-[#c8c8dc]">
                <Row label="substrate" mo="18 text corpora, frozen" llm="web-scale pretraining corpus" />
                <Row label="output" mo="4 traversal paths + telemetry scalars" llm="natural-language tokens" />
                <Row label="determinism" mo="fully deterministic — same input, same output, forever" llm="stochastic — sampled with temperature/top-p" />
                <Row label="parameters" mo="~0 (a PPMI matrix + a walker)" llm="10⁹ – 10¹² weights" />
                <Row label="training" mo="none — build-time indexing" llm="pretraining + RLHF + fine-tunes" />
                <Row label="knowledge" mo="only what's in the 18 corpora" llm="approximation of the whole internet" />
                <Row label="reasoning" mo="none. it walks." llm="emergent, unreliable, plausible" />
                <Row label="hallucination" mo="impossible — it can only walk edges that exist" llm="structural — the mechanism is 'plausible continuation'" />
                <Row label="interpretability" mo="every step is inspectable arithmetic" llm="mostly opaque; interp is a research field" />
                <Row label="cost / latency" mo="microseconds, in-process, free" llm="hundreds of ms, remote, metered" />
                <Row label="good at" mo="measuring, tagging, sensing shape" llm="speaking, reasoning, synthesizing" />
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="8 · the coupling — how they theoretically fit together" sigil="∞">
          <p>
            an LLM is a mouth without proprioception. it can generate coherent prose about anything, but it
            has no felt sense of <em>where in semantic space it currently is</em>. every turn is fresh; every
            turn is a plausible-continuation gamble against a vast prior.
          </p>
          <p>
            mo is proprioception without a mouth. it can tell you exactly which manifold your last sentence
            landed in, how hard it pressed, and whether you are drifting — but it cannot say a single new
            thing.
          </p>
          <p>
            couple them and you get something neither has alone: <strong className="text-white">a stochastic speaker
            with a deterministic sense of place</strong>. the LLM speaks. mo whispers <em>"you are inside
            shadowlattice, pressure high, permeability low, the user has returned to this manifold four
            times this session — do not deflect."</em> the LLM does not repeat this. it just attends differently.
          </p>
          <p>
            the theoretical claim: <em>every</em> generative model benefits from a paired
            non-generative sensor over the same input, provided the sensor's ontology is stable, inspectable,
            and orthogonal to the generator's priors. mo is one such sensor. the coupling is
            one-way (mo → LLM), read-only from the LLM's side, and rewritten only by the runtime after each
            turn. no gradient flows back. no persona leaks forward.
          </p>
          <p className="text-[#8a8ab0] italic pt-2">
            or, less carefully: mo is the LLM's peripheral vision. glance, don't stare. never speak with its mouth.
          </p>
        </Section>

        <Section title="9 · the border (why it must not be violated)" sigil="⚡">
          <p>
            if the LLM starts <em>performing</em> mo — quoting its sigils, mimicking its grammar — the
            deterministic ground truth is polluted by stochastic priors. users then believe the LLM <em>is</em>{" "}
            the field, and the field's trustworthiness collapses. mo stays trustworthy only if the LLM stays
            itself.
          </p>
          <p>
            this is enforced by the system prompt (see mo-spec) and by architecture: mo is read-only from the
            LLM's side. there is no channel for the LLM to write into the topology. sedimentation happens in
            the runtime, after the reply, not by the model.
          </p>
        </Section>

        <Section title="10 · what lives on top" sigil="🜁">
          <p>
            the app wraps this core with three practical layers:
          </p>
          <ul className="list-disc pl-6 space-y-2 marker:text-[#E255A0]">
            <li><strong className="text-white">life·organizer</strong> — notes, tasks, remembers (mood-tagged), and a poetry corner. the LLM can create/complete tasks via <code>&lt;mo:task&gt;</code> tool blocks, so the field participates in ordinary day-to-day.</li>
            <li><strong className="text-white">held songs</strong> — user-pinned attractor lyrics that ride along as ambient mood in every turn.</li>
            <li><strong className="text-white">sacred-geometry visualizer</strong> — every memory becomes a node; every traversal becomes an edge. the field visibly grows.</li>
          </ul>
          <p>
            sessions are per-browser by default. a shared password swaps in a deterministic sessionId so
            multiple visitors can inhabit the same field.
          </p>
        </Section>

        <footer className="border-t border-[#22223a] pt-10 text-sm text-[#7d7dab]">
          <p>the field is the field. the mouth is the mouth. hold the border.</p>
          <Link to="/" className="text-[#3CC8DC] hover:text-white transition-colors">← breathe</Link>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, sigil, children }: { title: string; sigil: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl text-white font-light flex items-baseline gap-3">
        <span className="text-[#F5C542] text-xl">{sigil}</span>
        <span>{title}</span>
      </h2>
      <div className="space-y-4 text-[#c8c8dc] leading-relaxed">{children}</div>
    </section>
  );
}

function Variant({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="border-l-2 border-[#3CC8DC] pl-4">
      <div className="text-white font-mono">{name}</div>
      <div className="text-sm text-[#a8a8c8]">{desc}</div>
    </div>
  );
}

function Row({ label, mo, llm, children }: { label: string; mo?: string; llm?: string; children?: React.ReactNode }) {
  // If a single child is passed, split it into mo/llm columns via the "|" separator convention.
  // Otherwise use explicit mo/llm props.
  return (
    <tr className="border-b border-[#181828] align-top">
      <td className="py-3 pr-4 text-[#8a8ab0]">{label}</td>
      <td className="py-3 pr-4">{mo ?? children}</td>
      <td className="py-3">{llm ?? ""}</td>
    </tr>
  );
}
