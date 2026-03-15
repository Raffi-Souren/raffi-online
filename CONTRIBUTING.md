# Contributing to raffi.computer

## Development

```bash
npm install
npm run dev     # localhost:3000
npm run build   # verify before pushing — runs TypeScript + ESLint checks
```

## Workflow

### Content changes (blogroll entries, articles, tracks)

Small, low-risk. Edit directly on `main` and push.

```bash
# edit the file
npm run build   # verify nothing broke
git add <file>
git commit -m "feat: add X to blogroll"
git push origin main
```

### Feature changes (new components, layout changes, dependencies)

Use a short-lived branch and PR.

```bash
git checkout -b feature/my-change
# make changes
npm run build
git push -u origin feature/my-change
gh pr create
```

Merge or close within a day or two to avoid drift.

### Using v0 for changes

v0 sometimes bundles unwanted "cleanup" commits alongside your actual change. Before merging any v0 PR:

1. Check the full diff on GitHub — make sure it only contains your intended change
2. If v0 added extra commits (refactors, deletions), close the PR and cherry-pick only the content change into `main`
3. Never merge a v0 PR without reviewing every file in the diff

## Rules

- Always run `npm run build` before pushing — it catches broken imports and type errors
- Keep branches short-lived to avoid merge conflicts
- Don't commit `node_modules/`, `.env`, or `.next/`
- Don't add `console.log` to production code
- Don't re-add `"latest"` as a dependency version — always pin to a real version with `^`
