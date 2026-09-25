# Releasing Penny Dreadful

The shape is Air Bladder's: work on `dev`, release from `master`, tag on Gitea,
let the mirror carry the tag to GitHub, let GitHub Actions build and publish.

**Never create a tag or a release on GitHub.** The Gitea → GitHub push mirror
force-syncs refs and prunes anything that exists only on GitHub, which turns a
GitHub-made release into a draft in silence.

## Procedure

1. On `dev`: write the notes under `## X.Y.Z` in `CHANGELOG.md` and commit them.
   Preview the release body:

   ```
   npm run release X.Y.Z -- --dry-run
   ```

2. Run the gates: `npm run check` and `npm run build:packs` (Foundry stopped),
   then load the system once on the dev server.

3. Merge and cut:

   ```
   git checkout master && git pull && git merge dev
   npm run release X.Y.Z
   ```

   This bumps `system.json`, commits `Release X.Y.Z`, creates an annotated tag
   whose body is the changelog section, and pushes branch and tag to `origin`
   (Gitea) atomically.

4. The mirror syncs on push. Confirm the tag reached GitHub:

   ```
   git ls-remote --tags github refs/tags/X.Y.Z
   ```

5. The "Release Creation" workflow runs on the tag and attaches `system.json`
   and `system.zip`. Verify anonymously:

   ```
   curl -sI https://github.com/domfortunato/penny-dreadful-foundryvtt/releases/latest/download/system.json
   ```

   If the workflow did not fire, run it from the Actions tab with the tag.

6. Sync `dev`, or the next merge conflicts on the version bump:

   ```
   git checkout dev && git merge master && git push origin dev
   ```

7. Test the release as a player gets it. The test app (http://192.168.30.125:30001)
   installs Penny Dreadful from the manifest, not from git: Setup → Game Systems →
   **Update** (or, on a fresh app, Install System with the manifest URL above).
   Load a world and check the version in Setup reads X.Y.Z.

## Redoing a version

```
git tag -d X.Y.Z && git push origin :refs/tags/X.Y.Z
```

then fix, and cut again.
