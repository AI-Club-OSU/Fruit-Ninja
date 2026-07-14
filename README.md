# Fruit Ninja

A browser-first Fruit Ninja game foundation built with React, TypeScript, Tailwind CSS, Vite+, and MediaPipe Tasks Vision. The goal is webcam fingertip tracking, swipe detection, and real-time fruit slicing without a controller.

> [!NOTE]
> This repository currently contains the application shell, game-domain contracts, swipe math, tests, and delivery pipeline. Camera access, hand tracking, fruit physics, and scoring are the next milestones.

## Get running

Vite+ manages Node.js, the package manager, the dev server, formatting, linting, type checking, tests, and builds for this project.

### 1. Install prerequisites

Install [Git](https://git-scm.com/downloads) if it is not already available.

Install Vite+ from its official installer:

**Windows PowerShell**

```powershell
irm https://vite.plus/ps1 | iex
```

**macOS or Linux**

```bash
curl -fsSL https://vite.plus | bash
```

Open a new terminal and verify the installation:

```bash
vp --version
```

### 2. Download the project

```bash
git clone https://github.com/Jeeya7/Fruit-Ninja.git
cd Fruit-Ninja
vp install
```

### 3. Start developing

```bash
vp dev
```

Open the local URL printed by Vite+ (normally `http://localhost:5173`). That is the only command needed for the normal development loop.

## Project commands

| Command          | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `vp dev`         | Start the app with hot reload                      |
| `vp check`       | Check formatting, lint rules, and TypeScript types |
| `vp check --fix` | Format and automatically fix supported lint issues |
| `vp test`        | Run the test suite once                            |
| `vp test watch`  | Run tests while developing                         |
| `vp build`       | Create a production build in `dist/`               |
| `vp preview`     | Preview the production build locally               |
| `vp run ready`   | Run every local CI check in sequence               |

Use Vite+ for dependencies too: `vp add <package>`, `vp remove <package>`, and `vp update`. Do not run pnpm, npm, Yarn, or Bun directly in this repository.

## Foundation

```text
src/
├── game/             Pure game and gesture-domain logic
├── vision/           Browser camera and hand-tracker contracts
├── App.tsx           Current training-stage shell
├── index.css         Visual system and responsive layout
└── main.tsx          React entry point
```

- `@mediapipe/tasks-vision` is installed for the upcoming hand-landmark adapter.
- Tailwind CSS 4 is connected through its first-party Vite plugin and is ready for utility classes.
- Gesture math is isolated from MediaPipe so it can be tested without a webcam or browser.
- The vision contract keeps camera/model lifecycle code separate from the render and game loops.
- GitHub Actions uses the official Vite+ setup action and runs install, static checks, tests, and the production build on pushes and pull requests.

## Camera development notes

Browsers allow webcam access only from a secure context. `localhost` is accepted during development; deployed builds must use HTTPS. The app will request camera permission only after the tracking milestone is implemented and the player explicitly starts a session.

For the first supported path, use a current Chromium browser such as Chrome or Edge with a webcam available.

## Contributing

Read [`AGENTS.md`](./AGENTS.md) before making changes. Before opening a pull request, run:

```bash
vp run ready
```
