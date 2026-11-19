# Restoring the pre-redesign site

On 2026-11-19 the live site switched to the Indigo Geometry redesign in a single
commit, and the old page code was removed in that same commit.

| What | Value |
| --- | --- |
| Switch-over commit | `e4be8540cd25e4570e4702457e7cf95714c89885` (`e4be854`) |
| Old site, tag (on origin) | `legacy-design-2026-11-19`, "Full pre-redesign site" |
| Old site, branch (on origin) | `legacy/old-design` |

If the PR was squash-merged or rebased, the commit on `main` has a different
hash. Find it with `git log --oneline --grep "switch the live site to the Indigo design" main`
and use that hash in place of `e4be854` below.

## Option A: revert the switch (recommended)

```sh
git revert --no-edit e4be854
```

This brings back the old pages, components and CSS, removes the
`/redesign/*` redirects, and keeps every later change that is not part of the
switch. It was tested: after the revert, every old-design file matches the tag.
Afterwards the new design is still reachable in git history. Re-applying it is
`git revert <the revert commit>`.

## Option B: take the files from the tag

Use this if the revert conflicts with later edits to the same files:

```sh
git checkout legacy-design-2026-11-19 -- app components lib next.config.ts
```

Review `git status` before committing. This also resets any later edits under
those folders to their 2026-11-19 state, so check that it leaves backend,
API and payment fixes made since then untouched.

Neither option touches the database, Prisma schema, environment variables or
payment keys. The switch changed none of them.
