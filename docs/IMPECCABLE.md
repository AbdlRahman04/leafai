# Impeccable for LeafAI

Impeccable is installed as a project-local Codex skill under
`.agents/skills/impeccable/`. Use `$impeccable` in Codex and choose a command,
for example `$impeccable audit the upload flow` or `$impeccable polish the
dashboard`. The shared product context is in `PRODUCT.md`; the current visual
system is in `DESIGN.md`.

## Hook approval

The project hook is configured in `.codex/hooks.json` and runs the Impeccable
detector on relevant UI edits. After installing or updating Impeccable, open
`/hooks` in Codex and approve the project hook. Codex requires this explicit
trust step before the hook can run.

## Detector and frontend checks

From the repository root, scan the React source with:

```powershell
npx impeccable detect frontend/src
```

Review findings against `DESIGN.md`; a documented brand choice may be
intentional, but accessibility and usability issues still need attention.
Run the frontend checks from `frontend/`:

```powershell
npm run lint
npm run build
```

Impeccable installation and command details:
[Impeccable README](https://github.com/pbakaus/impeccable#readme). The format
of the design reference is informed by [Awesome DESIGN.md](https://github.com/voltagent/awesome-design-md).
