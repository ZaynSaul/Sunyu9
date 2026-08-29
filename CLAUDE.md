# Sunyu9 — working notes for Claude

Offline-first Expo app that upgrades Gambian phone contacts from 7-digit to
9-digit numbers. See `README.md` for the full picture.

## Non-negotiables

- **No network.** No account, no server, no analytics, no contact uploads. Every
  feature runs on-device. If a change would add a network call, stop and flag it.
- **Nothing is written to contacts without an explicit preview + confirmation**,
  and never without a local backup first (backup/undo is a later milestone).
- **Conservative conversion.** Only convert numbers whose leading digits clearly
  map to a migrating operator (`constants/numbering.ts`). Leave everything else
  untouched — Gamcel (`9`), fixed lines (`4`/`8`), international, already-9-digit,
  malformed.

## Conventions

- Expo SDK 57, Expo Router, TypeScript strict. Root-level layout (no `src/`).
- Path alias `@/*` → repo root.
- `expo-contacts` here is the **SDK 57 class API** (`Contact.getAllDetails`,
  `contact.patch`, `getPermissionsAsync`). The legacy `getContactsAsync` /
  `updateContactAsync` functions throw at runtime — do not use them.
- Keep pure logic (mapping, numbering) in files that import only *types* from
  native modules, so it stays unit-testable (`contactMapper.ts` is the pattern).
- `app.config.js` exports `{ expo: {...} }`. Config plugins drive native perms.

## Commands

`npm run typecheck` · `npm test` · `npx expo export --platform android` (bundle check)
