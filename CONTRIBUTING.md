# Contributing

Thanks for helping improve Vikesh Codes Creator OS.

## Local Setup

```bash
git clone https://github.com/vikeshcodes/creator-os.git
cd creator-os
npm run setup
cp creator-os.config.example.json creator-os.config.json
npm run dev:local
```

Install dependencies if setup reports missing `node_modules`:

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../admin && npm install
```

## Run The Project

```bash
npm run dev:local
```

Open:

- Admin: `http://localhost:5160/admin`
- Overlay: `http://localhost:5150/overlay/main-overlay`
- Backend: `http://localhost:5170/health`

## Branches

Create a focused branch:

```bash
git checkout -b fix/short-description
```

Use branch prefixes like:

- `fix/`
- `feature/`
- `docs/`
- `theme/`
- `refactor/`

## Pull Requests

Before opening a PR:

- Test locally.
- Do not commit secrets.
- Update docs if behavior changes.
- Include screenshots for UI changes.
- Keep changes focused.

Only VikeshCodes maintainers can decide what becomes part of the official project.

## Code Style

- Prefer clear, modular code.
- Keep OBS overlay code lightweight.
- Avoid unnecessary dependencies.
- Keep UI professional and local-first.
- Do not add third-party livestream alert services.
- Use official APIs for platform integrations.

## Commit Messages

Use concise, descriptive commits:

```text
fix: prevent duplicate YouTube chat events
feat: add vertical overlay preset
docs: clarify OAuth setup
```

## Bug Reports

Include:

- What happened
- Steps to reproduce
- Expected behavior
- OS
- Node version
- Browser or OBS version
- Overlay ID
- Backend logs when useful

## Feature Requests

Include:

- The problem
- Proposed solution
- Use case
- Alternatives considered
- Priority

## Security Issues

Do not open public issues for security reports. Follow [SECURITY.md](SECURITY.md).

## Local Testing Checklist

- `npm run check`
- `npm run lint`
- `npm test`
- `npm run dev:local`
- Open admin at `http://localhost:5160/admin`
- Open overlay at `http://localhost:5150/overlay/main-overlay`
- Trigger test YouTube events
- Confirm no secrets are in the diff

## Contribution Ownership Terms

By submitting a pull request, contributors agree that their contribution will be licensed under the same license as the project and may be used, modified, released, or distributed by VikeshCodes as part of the official project.

By contributing, you certify that you have the right to submit the contribution and agree to license it under this project’s license.
