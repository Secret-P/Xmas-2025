# Manna Family Wish List

A static, mobile-first wish list for one family. Serve the repository root over HTTP, for example with `python -m http.server 8000`. The existing GitHub Pages deployment uses the same relative paths. Firebase configuration and SDK version live in `firebase-config.js`.

## How the app works

- `auth.js` checks the signed-in Google user's existing family profile on the server before giving `app.js` a session. Profile updates use update-only writes. Register family members through trusted Firebase administration.
- `app.js` owns navigation, the active session and selection, listener teardown, messages, and the gift editor.
- `data.js` contains the Firestore queries and writes. My List filters by both owner and creator and never subscribes to coordination data. Family Lists subscribes to one other recipient at a time. Stored 2025 documents keep their existing paths and fields.
- `family-list.js` joins each recipient item to its live giver records. It publishes complete current results and ignores callbacks for inactive selections and removed items. One subscription per visible recipient item is appropriate for this family-sized dataset.
- `gift-row.js` uses native disclosures, text nodes and HTTP(S) links. Only the giver who marked a purchase can undo that mark. Legacy multiple-purchaser records display each buyer. Notes belong to their individual authors.
- `index.html`, `styles.css`, `manifest.webmanifest` and `icons/` provide the interface and home-screen support. The app uses a live connection.

## Firestore and release checks

The original repository did not contain the deployed Firestore rules. The proposed `firestore.rules` is a reviewable policy for this client. Publishing the GitHub Pages site does not deploy Firebase rules. Compare with the active policy and validate with separate member, recipient and unregistered test identities before a Firebase rules release. Test direct reads as well as list queries. Surprise creation with an initial giver note uses a single batch. Its rule checks the parent with `getAfter`.

The existing collections are `users/{uid}`, `items/{id}` and `items/{id}/giverData/{giverUid}`. Deleting a parent gift leaves any historical subcollection documents in Firestore. The proposed policy checks the parent before granting read access. There is no production data migration or cleanup step.

Run the deterministic listener regression tests with `node --test tests/*.test.mjs` (Node 24). Check real Google sign-in, Firestore permissions and iPhone Safari / Add to Home Screen before release.
