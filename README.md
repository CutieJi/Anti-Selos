# Anti-Selos System

A small relationship-support dashboard built with HTML, CSS, JavaScript modules, Firebase Authentication, and Cloud Firestore.

## Features

- Anonymous Firebase sign-in with shared secret-code accounts.
- Live selos count and agreement status.
- A shared comment thread; partners can post messages and see new comments in real time.
- Responsive dashboard and compact sign-in screen.

## Firebase setup

The application uses the Firebase project configured in `app.js`. To use another project, replace `firebaseConfig` with that project's web app configuration.

1. In the Firebase console, enable **Authentication → Sign-in method → Anonymous**.
2. Create or enable a **Cloud Firestore** database.
3. Open **Firestore Database → Rules**, replace the rules with the contents of [`firestore.rules`](./firestore.rules), and publish them.
4. Serve this folder from a local web server or static host, then open `index.html`. Firebase modules should be loaded over HTTP or HTTPS rather than from a `file://` URL.

The rules allow signed-in clients to look up an account by its hash, but do not allow listing account documents. Messages live in each account's `messages` subcollection; they are limited to 500 characters, attributed to the posting user's Firebase Auth ID, and cannot be edited or deleted by clients.

> **Shared-code access:** The secret code is a bearer credential. Anyone who has it can access the associated shared account after signing in. Keep it private.

If the message area says Firebase blocked messages, publish `firestore.rules` to the same Firebase project configured in `app.js`, then reload the dashboard.

### Deploy rules with the Firebase CLI (optional)

If the Firebase CLI is installed and this folder is configured for the correct Firebase project, deploy the checked-in rules with:

```sh
firebase deploy --only firestore:rules
```

If the folder is not configured yet, run `firebase init firestore` first, select the intended project, and use `firestore.rules` as the rules file.
