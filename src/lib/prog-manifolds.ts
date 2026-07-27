// Programming-language manifolds — semantic terrain, NOT modes.
// The engines (mo/gremolin/anansi/mohini/mimic) walk this terrain.
// Each corpus is a compact seed of the language's core vocabulary and idioms.

import cps0Text from "@/corpora/CPS-0-2.txt?raw";


export type ProgManifold = {
  id: string; name: string; sigil: string; color: string; breath: string; text: string;
};

const typescript = `
typescript type interface generic constraint union intersection literal narrow inference infer keyof typeof extends conditional mapped template partial readonly optional required record pick omit exclude parameters returntype awaited promise async await function arrow method const let var enum namespace module import export default from as satisfies unknown never any void object null undefined boolean number string array tuple readonly-array mutable immutable strict tsconfig target lib module-resolution baseurl paths declaration dts types nodenext esnext bundler jsx react-jsx strictnullchecks nostrictgenericchecks compiler transpile emit decorator experimental class abstract private public protected getter setter static override implement extend generic-parameter type-parameter default-type variance covariant contravariant invariant assertion cast as-const type-guard predicate discriminated-union tagged-union exhaustive switch never-exhaustive pattern match ts-expect-error ts-ignore lint eslint prettier
`;

const rust = `
rust ownership borrow reference lifetime mutable immutable move copy clone drop trait impl generic type bound constraint where associated method self static function fn let mut const closure fnmut fnonce box arc rc mutex rwlock cell refcell atomic sync send unsafe raw pointer null option some none result ok err try question-mark unwrap expect match if-let while-let loop break continue iterator map filter fold collect into from vec string str slice hashmap btreemap vecdeque enum struct tuple pattern destructure macro derive debug clone default partialeq eq hash serialize deserialize serde tokio async await future stream cargo crate module pub visibility rustfmt clippy target wasm no-std alloc collections thread spawn join channel mpsc oneshot select
`;

const python = `
python def class self init dunder magic property staticmethod classmethod decorator inheritance super mro abstract abc protocol duck typing dynamic strong weak namespace scope global nonlocal closure lambda list dict set tuple comprehension generator yield yield-from iterator iterable range map filter reduce zip enumerate any all sorted reversed print input len type isinstance issubclass hasattr getattr setattr delattr callable object none true false async await asyncio coroutine event-loop future task gather run gather concurrent thread process multiprocessing gil pip venv pipenv poetry requirements virtualenv package module __init__ __main__ if-name-main try except finally raise exception valueerror typeerror keyerror indexerror stopiteration context manager with contextmanager dataclass pydantic typing optional union callable typevar generic protocol runtime_checkable
`;

const sql = `
sql select from where group by having order limit offset join inner left right full outer cross lateral union intersect except distinct where clause predicate index btree hash gin gist brin unique primary key foreign references cascade restrict null default check constraint transaction begin commit rollback savepoint isolation read-committed serializable repeatable-read snapshot mvcc row-level lock advisory-lock deadlock plan explain analyze vacuum reindex partition inheritance schema table view materialized-view function trigger sequence extension role grant revoke public authenticated service jsonb array text integer bigint numeric timestamp tz interval uuid generate insert update delete upsert on-conflict returning cte with recursive window over partition rank dense-rank row-number lag lead first-value last-value nth-value
`;

const react = `
react component jsx tsx element node fragment children props state hook useState useEffect useMemo useCallback useRef useReducer useContext useLayoutEffect useTransition useDeferredValue useId useSyncExternalStore useImperativeHandle forwardRef memo lazy suspense boundary error fallback render mount unmount effect cleanup dependency array closure stale reference key reconciliation diff virtual dom fiber concurrent mode strict server client server-component use-client use-server action form transition optimistic hydration ssr csr rsc streaming router navigation link outlet route loader query mutation cache invalidate provider consumer context store slice reducer dispatch action selector portal ref imperative controlled uncontrolled form event synthetic bubble capture propagation prevent-default stop-propagation
`;

const css = `
css selector class id attribute pseudo pseudo-class pseudo-element hover focus active visited before after nth-child nth-of-type not is where has specificity cascade inheritance important normal specificity-tie-break box-model margin padding border radius shadow outline width height min max flex grid container query media query break-point mobile tablet desktop responsive fluid clamp min max function calc var custom property design-token color hsl rgb rgba oklch lch p3 srgb linear-gradient radial-gradient conic-gradient background image cover contain repeat position fixed absolute relative sticky static z-index stacking context transform translate rotate scale skew matrix transition duration timing-function ease cubic-bezier animation keyframes opacity visibility display none block inline flex grid inline-block none contents fit-content max-content min-content aspect-ratio object-fit filter blur backdrop
`;

const algorithms = `
algorithm complexity big-o omega theta amortized linear logarithmic quadratic cubic exponential polynomial np-hard np-complete p decidable heuristic greedy divide-conquer dynamic-programming memoization tabulation recursion backtracking branch-bound iterative loop invariant termination correctness proof induction sort quicksort mergesort heapsort timsort insertion bubble selection radix bucket counting search binary linear interpolation depth breadth first bfs dfs traversal graph tree binary balanced avl red-black heap priority-queue queue stack deque linked-list array hash-table dictionary map set trie bloom-filter skip-list segment-tree fenwick union-find disjoint-set kmp suffix automaton ukkonen dijkstra bellman-ford floyd-warshall prim kruskal topological-sort scc tarjan flow max-flow min-cut ford-fulkerson lp simplex convex-hull rolling-hash suffix-array
`;

const regex = `
regex pattern anchor start end boundary word non-word digit non-digit space non-space class character set negation range quantifier greedy lazy possessive zero one more optional exactly at-least between capture group non-capturing named backreference lookahead lookbehind negative positive alternation atomic conditional flag ignore case multiline dotall unicode global sticky escape backslash bracket parenthesis brace pipe question star plus caret dollar dot literal metacharacter engine pcre re2 posix ecmascript unicode-property script block category general grapheme codepoint utf8 utf16 surrogate pair combining mark boundary word-break lookaround width variable
`;

const git = `
git commit branch merge rebase cherry-pick reset revert log diff status add stage unstage restore checkout switch worktree stash pop apply clone fetch pull push origin upstream remote tracking hook pre-commit post-commit reflog head detached fast-forward squash amend interactive conflict resolve mine theirs base three-way patch bundle bisect blame tag annotated lightweight sign gpg subtree submodule sparse-checkout shallow clone-depth fork upstream downstream pr merge-request review approve rebase-and-merge squash-and-merge fast-forward-only trunk-based-development gitflow release changelog semver tag-release monorepo polyrepo lfs large-file annex ignore attributes
`;

const docker = `
docker container image layer volume network bridge overlay host bind mount tmpfs registry hub push pull tag digest manifest platform arch amd64 arm64 multi-arch buildx dockerfile from run copy add cmd entrypoint env expose workdir user args label healthcheck stopsignal onbuild volume-declare compose service depends-on healthcheck condition profile environment env-file secret config network subnet gateway ipam nginx alpine slim distroless scratch bootstrap init pid1 signal handling graceful shutdown restart policy unless-stopped always no on-failure resource cpu memory limit reservation swap oom-kill cgroup namespace pid network mount ipc uts user rootless podman kubernetes pod replicaset deployment service ingress configmap secret pvc storageclass helm
`;

const http = `
http request response status code method get post put patch delete head options trace connect head body header content-type content-length authorization bearer basic cookie set-cookie session csrf cors origin access-control-allow preflight options-request cache-control etag last-modified if-none-match if-modified-since 200 201 204 301 302 304 400 401 403 404 405 409 410 422 429 500 502 503 504 keep-alive connection pipeline http1 http1.1 http2 http3 quic tls handshake alpn sni certificate chain webhook signature hmac timing-safe idempotent safe cacheable retriable rate-limit exponential-backoff jitter circuit-breaker retry timeout deadline propagation trace-id span-id b3 open-telemetry rest openapi swagger schema pagination cursor offset limit filter sort include sparse-fieldset json-api graphql query mutation subscription
`;

export const PROG_MANIFOLDS: ProgManifold[] = [
  // CPS-0 is the *hyperfold operator*: a meta-manifold whose grammar
  // (SOURCE;OP:TARGET::PAYLOAD) is parsed and used to mutate every other
  // operator's walk options and to write directed sediment. It programs
  // the field. Its text seeds the terrain; its parser rewires the walkers.
  { id: "cps0", name: "CPS-0", sigil: "⌘", color: "#F0F0FF", breath: "hyperfold operator — SOURCE;op:TARGET::payload programs the field", text: cps0Text },
  { id: "typescript", name: "TypeScript", sigil: "ᴛs", color: "#3178C6", breath: "types as topology — narrow the world", text: typescript },
  { id: "rust", name: "Rust", sigil: "🦀", color: "#DEA584", breath: "ownership as gravity — nothing escapes", text: rust },
  { id: "python", name: "Python", sigil: "🐍", color: "#3776AB", breath: "readability as duck — walks and quacks", text: python },
  { id: "sql", name: "SQL", sigil: "◨", color: "#E48E00", breath: "set as thought — declare, don't march", text: sql },
  { id: "react", name: "React", sigil: "⚛", color: "#61DAFB", breath: "state as function of props — rendered breath", text: react },
  { id: "css", name: "CSS", sigil: "◐", color: "#264DE4", breath: "cascade as inheritance — specificity rules", text: css },
  { id: "algorithms", name: "Algorithms", sigil: "∴", color: "#B892FF", breath: "complexity as terrain — big-O gravity", text: algorithms },
  { id: "regex", name: "Regex", sigil: "\\R", color: "#FF6E6E", breath: "pattern as claw — anchor, match, backtrack", text: regex },
  { id: "git", name: "Git", sigil: "⎇", color: "#F1502F", breath: "history as graph — commit, branch, rebase", text: git },
  { id: "docker", name: "Docker", sigil: "◫", color: "#0DB7ED", breath: "container as capsule — build once, run there", text: docker },
  { id: "http", name: "HTTP", sigil: "⇋", color: "#7DE2D1", breath: "request as inquiry — response as verdict", text: http },
];

