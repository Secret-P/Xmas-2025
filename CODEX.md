**Project Name**: Xmas Wish List (Manna Family Wish List)

**Short description**
- A small client-side single-page app (vanilla JS) for family gift lists. Users sign in with Google, maintain their own visible wish list, and can anonymously add gifts to other family members' lists. It uses Firebase Authentication and Firestore for storage.

**Repository files (key)**
- `index.html` : Complete UI + styles; mounts the app and loads modules.
- `firebase-config.js` : Firebase initialization and exports `app`, `auth`, `db`, `provider`. Update this with your project config if needed.
- `auth.js` : Google sign-in button, sign-out, `onAuthStateChanged` handler. Verifies user presence in `/users/{uid}` and updates profile fields.
- `app.js` : Main client logic. Handles My List, Family Lists, Firestore listeners, item creation/updates/deletes, giver notes, and purchased toggles.

**How it works (high level)**
- Authentication: Google sign-in via `auth.js`. After sign-in, the app checks for a Firestore document at `/users/{uid}` — if missing or unreadable under your Firestore rules the user is signed out.
- Data storage: A top-level collection `items`. Documents contain gift info (ownerId, createdBy, name, link, notes, createdAt, updatedAt). Each item may have a subcollection `giverData` containing documents keyed by giver uid, storing `purchased`, `note`, `updatedAt`.
- UI modes:
  - My List: items the current user created for themself (ownerId == currentUser.uid and createdBy == currentUser.uid).
  - Family Lists: list of other `users` from `/users` collection; selecting a recipient shows that recipient's `items` (`ownerId == recipientUid`) with shared giver notes.

**Firestore data model (examples)**
- /users/{uid} (doc)
  - displayName: string
  - email: string
  - photoURL: string
  - lastLoginAt: ISO timestamp

- /items/{itemId} (doc)
  - ownerId: uid (the recipient)
  - createdBy: uid (who added it)
  - name: string
  - link: string
  - notes: string (owner-visible)
  - createdAt: timestamp
  - updatedAt: timestamp

- /items/{itemId}/giverData/{uid} (doc)
  - giverId: uid
  - ownerId: uid (owner/recipient)
  - purchased: boolean
  - note: string (giver-visible, other givers can see this; recipient does not)
  - updatedAt: timestamp

**Notable client behaviors / implementation notes**
- `auth.js` signs users out if they are not listed under `/users/{uid}` — the app is intentionally limited to a registered family set.
- `app.js` uses realtime listeners (`onSnapshot`) for:
  - current user's own items (ordered by `createdAt desc`),
  - `/users` list (ordered by `displayName`),
  - recipient items (ownerId == selected recipient), and then fetches `giverData` for each item to compute `purchased` and gather shared notes.
- Marking purchased writes to `/items/{itemId}/giverData/{currentUser.uid}` using `setDoc` with `merge: true`.
- Adding an item for someone also optionally writes a giver note into the same `giverData` doc.

**Quick start / run locally**
1. Ensure the Firebase project config in `firebase-config.js` is correct for your project.
2. Serve the files as static content (browsers block `import` modules from `file://` in many cases). Example using Python or Node:

Powershell (Python built-in http server):
```
python -m http.server 8000
```

Powershell (npm http-server):
```
npx http-server -p 8000
```

Then open `http://localhost:8000` in your browser.

Alternatively deploy to Firebase Hosting:
```
npm install -g firebase-tools
firebase init hosting
firebase deploy --only hosting
```

**Security & Firestore Rules (recommended)**
- The client assumes Firestore rules restrict uncontrolled access. At a minimum:
  - Only authenticated users can read `/users` and `items` as appropriate.
  - Users can only create/update `items` they created, and only set `createdBy` to their own uid.
  - Only allow writing to `/items/{itemId}/giverData/{uid}` when the authenticated uid matches the subdoc id (so users cannot forge other givers' purchases/notes).

Example rule ideas (very high level):
  - match /users/{uid}: allow read if request.auth != null and user is in allowed family list; allow write if request.auth.uid == uid (or per your policy).
  - match /items/{itemId}: allow create if request.auth.uid == request.resource.data.createdBy; allow update/delete if request.auth.uid == resource.data.createdBy (or owners as required).
  - match /items/{itemId}/giverData/{giverId}: allow write only if request.auth.uid == giverId; allow read if request.auth.uid in family.

**Potential improvements / TODOs**
- Add client-side tests (Jest/Playwright) for UI flows.
- Add offline support / optimistic updates for better UX when connectivity is flaky.
- Paginate large lists and reduce number of `getDocs` calls when computing `giverData` for many items.
- Add role management or an admin UI to manage `/users` registration.
- Input validations and UX improvements (confirmations, error handling UI instead of alerts).

**Where to look in code**
- Core auth & registration: `auth.js` → `onAuthStateChanged` → `/users/{uid}` check.
- Listeners & rendering: `app.js` → `initMyListListener()`, `initUsersListener()`, `initRecipientItemsListener()`.
- Firestore schema interactions: search `collection(db, "items")`, `setDoc(doc(db, "items", itemId, "giverData", currentUser.uid)` in `app.js` for write examples.

If you'd like, I can:
- Add example Firestore rules (staged, with comments) tailored to this app.
- Wire up a `README.md` and a minimal `package.json` with a dev static-server script.

---
Generated on: 2025-12-05
