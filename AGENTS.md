<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep relational structural growth in a pure shared module, with persistence in a server-only wrapper, so traversal provenance can be tested without database access.
- Cadence Brain stores additive `::brain` snapshots separately from trainable Cadence state; clean Brain state round-trips in page memory to avoid changing persistent A/B/C.
- Structural ledgers observe completed paths only; emission may select visited lexical nodes but must retain full folds and report bounded exploration shortfalls.
