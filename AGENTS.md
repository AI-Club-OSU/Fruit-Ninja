# Repository instructions

## Use Vite+ for every project command

This repository uses **Vite+**, not standalone Vite or direct package-manager commands.

- Use `vp install`, `vp add`, `vp remove`, and `vp update` for dependencies.
- Use `vp dev`, `vp check`, `vp test`, `vp build`, and `vp preview` for the development lifecycle.
- Use `vp run <name>` only for a custom task from `package.json` (for example, `vp run ready`).
- Use `vp exec <binary>` for a local binary and `vp dlx <package>` for a one-off package.
- Do not invoke pnpm, npm, Yarn, Bun, npx, or their package scripts directly.
- Do not install Vitest, Oxlint, Oxfmt, or tsdown separately; Vite+ provides them.
- Import test utilities from `vite-plus/test` and configuration helpers from `vite-plus`.

Before considering a change complete, run:

```powershell
vp run ready
```

## Architecture boundaries

- Keep deterministic gameplay and gesture logic in `src/game` with unit tests.
- Keep webcam, MediaPipe, and browser-permission code in `src/vision`.
- Tailwind CSS 4 is available through `@tailwindcss/vite`; use utilities for new interface work while keeping bespoke animation and arena styles readable.
- Do not couple game rules directly to MediaPipe landmark objects; translate them at the vision boundary.
- Camera access must always follow an explicit player action and must be stopped when a session ends.

## Windows PowerShell path quoting

When running shell commands on Windows PowerShell, always quote file paths that contain special characters, especially route-group folders such as `(main)`.

```powershell
# Bad: PowerShell treats (main) as an expression or command.
rg -n "foo" apps/web/src/app/(main)/[workspaceSlug]

# Good:
rg -n "foo" 'apps/web/src/app/(main)/[workspaceSlug]'
```
