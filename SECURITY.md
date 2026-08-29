# Security Policy

Sunyu9 reads and writes the contacts on someone's phone, so a security issue
here can affect people's address books directly. Reports are taken seriously.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting instead:
**https://github.com/ZaynSaul/Sunyu9/security/advisories/new**

Please include:

- what the issue is and where in the code,
- how to reproduce it,
- what an attacker could do with it.

You'll get a first response within about a week.

## Scope

In scope:

- anything that writes wrong data to a contact, or writes without the preview +
  confirmation the app promises,
- any code path that sends contact data off the device (the app is meant to make
  zero network calls — see `app.config.js` `blockedPermissions`),
- backup / undo failing to restore the exact original numbers,
- the numbering engine converting numbers it shouldn't (see
  `constants/numbering.ts` for the conservative policy).

Out of scope:

- issues that require a already-compromised device or a malicious app with
  contacts permission,
- the placeholder operator monograms / cosmetic UI.

## What Sunyu9 does to stay trustworthy

- No account, no server, no analytics. Release builds ship with `INTERNET` and
  other networking permissions stripped from the manifest, so the OS app-info
  screen itself shows the app can't upload anything.
- Every contact write is previewed and confirmed first, and the complete
  original phone list is backed up on-device before any change.
- The full source is here so the above can be checked rather than trusted.
