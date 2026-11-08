# Rolling back the teaching additions

The baseline before the 8 November 2026 additions is commit
`5470350a9a4f9945b5add201fc2f10e79d5b67c4`. The release is retained on branch
`teaching-additions-2026-11-08`. The upstream interpreter is unchanged.

## Disable selected additions

Edit `demo/teaching-options.js`. Each switch is independent:

| Switch | Set to `false` to… |
| --- | --- |
| `explanations` | Hide the lesson, policy legend, comparison controls and supporting details again. |
| `libraryModel` | Remove the array-iteration/getter example. |
| `upgradeDisclosure` | Remove the final disclosure example from the upgrade sequence. |
| `declassification` | Remove the advanced declassification example and its extra native-comparison helper. The upstream interpreter's existing `declassify` operation remains unchanged. |
| `fixedTimers` | Restore randomized 500–1499 ms example delays and hide the added timer explanation. |

Setting all five to `false` removes the visible additions and restores the original
nine-example selection. It retains the supporting configuration and test code.
For the exact previous source tree, use the full Git rollback below.

Build and inspect the selected configuration before publishing:

```sh
node demo/test-teaching-options.cjs
./demo.sh export /tmp/jsflow-preview
python3 -m http.server --directory /tmp/jsflow-preview 8000
```

After checking the page, commit the switch changes on `main` and push. The existing
GitHub Pages workflow builds and deploys them. Changing the file alone does not
change the public site. Builds include the configuration in the asset identifier.

## Restore the complete previous version

Start from a clean working tree. These commands revert only the commits in the
retained additions branch and preserve the published history:

```sh
git switch main
git revert --no-commit 5470350..teaching-additions-2026-11-08
git diff --cached
git commit -m "Restore JSFlow demo before teaching additions"
git push origin main
```

If later work has changed the same files, resolve any conflicts before committing.
For an isolated preview of the baseline without changing the working branch:

```sh
git worktree add --detach /tmp/jsflow-before-additions 5470350
cd /tmp/jsflow-before-additions
./demo.sh export /tmp/jsflow-original-preview
```

## Checks for the enabled additions

The browser checks require an installed Playwright module and Chromium. Set
`PLAYWRIGHT_MODULE` to the module path if it is not on the normal resolution path.
Run against a locally served build, or pass the public site URL after deployment.

```sh
node demo/test-browser.cjs http://localhost:8000/
node demo/test-callbacks.cjs http://localhost:8000/
node demo/test-teaching-ui.cjs http://localhost:8000/
node demo/test-library-model.cjs http://localhost:8000/
node demo/test-upgrade-disclosure.cjs http://localhost:8000/
node demo/test-declassification.cjs http://localhost:8000/
```

Run each addition-specific check when its switch is enabled. The options check
exercises all 32 combinations without modifying the configuration file. The
library check steps over `Array.every`: its synchronous model cannot pause inside
the getter. It checks the secret context at rejection and uses native, public-input
and short-circuit controls.
