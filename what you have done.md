# What I have done

The project lives in `E:\projects\face-auth-experiment`. I built the requested React/Vite/TypeScript frontend and NestJS/TypeScript REST backend. Your existing Supabase tables are used. There are exactly four application screens: Register, Login, Dashboard, and Not Found.

## 1. Read the instructions and inspected the folder

1. Listed the project files with `rg --files` and `Get-ChildItem -Force`.
2. Read **all** of `readthisbeforecreatingproject.txt` with `Get-Content -Raw`.
3. Checked the project and parent folders for `AGENTS.md`; none were present.
4. Checked `node --version`, `npm --version`, and `git --version`. The machine has Node 24.16.0, npm 11.13.0, and Git 2.52.0.
5. Consulted the official Human embedding/matching source, Supabase database-function documentation, and NestJS authentication/cookie documentation.
6. Initial `npm view` requests for Human, NestJS, Vite, and React were blocked by the restricted network environment. I used approved network access for the dependency installation instead.

## 2. Created the project structure

7. Created `.gitignore` in the **main folder**, before installing dependencies. It excludes dependencies, builds, local environment files, logs, caches, generated model assets, and editor files. It also excludes your original text file because it contains the server key. `.env.example` is allowed into source control.
8. Created `frontend/` and `backend/` directly in the main folder. I wrote a minimal scaffold myself instead of running generators that would add unused pages or README files.
9. Created the root `package.json` as an npm workspace containing both folders. This lets one install command set up both applications, with one root lockfile.
10. Added root commands to start both apps, build, test, type-check, copy models, check the database, format source, and run the live integration test.
11. Created frontend package/config files, Vite configuration, `index.html`, and the app favicon.
12. Created backend package/config files, Nest CLI configuration, and TypeScript build settings. The bootstrap passes an explicit `ExpressAdapter`, keeping driver resolution reliable in the npm workspace.

## 3. Installed dependencies

13. From the **main folder**, ran `npm install --cache .npm-cache --no-fund --fetch-retries=0`. npm installed the dependencies for both workspaces. No separate global Nest installation is needed.
14. Frontend dependencies include React, React DOM, React Router, Vite, TypeScript, Lucide icons, and **Human 3.3.6**, pinned exactly so recognition models do not drift.
15. Backend dependencies include NestJS, its configuration/JWT/throttling modules, Supabase's server client, validation/transform libraries, cookie-parser, Helmet, and RxJS. Added Jest/Supertest for API testing and Vitest for the camera module.
16. Added `frontend/scripts/copy-models.mjs`. The frontend postinstall/build commands copy the required BlazeFace, FaceMesh, and FaceRes JSON/weight files from the installed Human package into `frontend/public/models/`. The files are served locally; recognition does not depend on a model CDN.
17. Initially copied the optional iris model as well, then removed those two generated files and narrowed the copy script to the three enabled models.
18. Ran `npm audit --json --cache .npm-cache --fetch-retries=0` after npm reported dependency issues. Added the patched `multer` override with `npm pkg set 'overrides.multer=^2.3.0'` and ran `npm install --save-dev 'vitest@^4.1.11' -w frontend --cache .npm-cache --no-fund --fetch-retries=0`. The resulting audit reported **zero vulnerabilities**.
19. Installed a local formatter with `npm install --save-dev prettier --cache .npm-cache --no-fund --fetch-retries=0`. Created `.prettierrc.json` and `.prettierignore`, and added `npm run format` for readable, consistent source files. That install exposed that npm had restored the old transitive `multer` despite the override. Inspected it with `npm explain multer` and `npm ls multer`, and tried `npm update multer --cache .npm-cache --no-fund --fetch-retries=0`; the override still did not take effect. Checked the official registry's current versions and peer dependencies with `npm view`, then updated Nest common/core/platform-express/testing to `^12.0.3`, JWT to `^12.0.2`, and config to `^12.0.0` using `npm pkg set ... -w backend`. Removed the ineffective override with `npm pkg delete overrides` and reran `npm install --cache .npm-cache --no-fund --fetch-retries=0`. The final compatible NestJS installation reported **zero vulnerabilities**. Rebuilt and reran all tests after that upgrade.

## 4. Configured the backend environment

20. Created `backend/.env.example` with placeholders and documented settings.
21. Created the ignored `backend/.env` from the Supabase URL and secret key in your brief. Generated a separate random 48-byte JWT signing secret using the system cryptographic random generator. I did not print the generated secret or place it in frontend code.
22. Set the default frontend origin to `http://localhost:5173`, API port to `3000`, session lifetime to one hour, and `FACE_MATCH_THRESHOLD` to `0.5`.
23. Enabled `FACE_DEBUG_SCORES=true` for this experiment. The backend prints similarity and threshold values; it does not print emails, face vectors, cookies, or credentials.
24. Added startup validation so missing/invalid environment settings fail immediately. Production mode requires an HTTPS frontend origin and uses Secure cookies.

## 5. Added atomic registration to your existing database

25. Wrote `backend/sql/001_atomic_registration.sql`. It uses your existing `app_users`, `face_templates`, unique email index, foreign key, and vector column. It does not recreate or replace your tables.
26. Added the `register_face_user` function, which normalizes the email, inserts the user, and inserts all three numbered templates in one PostgreSQL transaction. A failed sample rolls back the entire operation. The existing unique index handles concurrent duplicate registrations.
27. Restricted execution to `service_role`; anonymous and authenticated browser roles cannot call the function. It uses `security invoker` with an empty search path and qualified table/type references.
28. Added `backend/scripts/check-database.mjs` and ran `npm run check:database` from the main folder. Both tables were accessible, but the function was initially missing.
29. Asked you to run the provided SQL in your project's Supabase SQL Editor because the supplied Data API key cannot install SQL functions. You confirmed that you ran it.
30. Ran `npm run check:database` again and confirmed both tables and the function were available. The function check deliberately uses invalid input that cannot create an account.

## 6. Implemented the reusable NestJS modules

31. Created `backend/src/database/` for the server-only Supabase client, with browser session persistence disabled and request timeouts.
32. Created `backend/src/users/` to register users, find an exact email case-insensitively, retrieve a user by ID, and fetch only that user's compatible templates. Email wildcard characters are escaped.
33. Created `backend/src/face/` for embedding validation, model identifiers, and matching. Valid input contains exactly 1024 finite numbers; empty, zero, malformed, and out-of-range vectors are rejected.
34. Implemented the pinned Human library's default similarity calculation on the server: order 2, multiplier 25, normalization 0.2–0.8, including its rounding behavior. Login chooses the best of the claimed account's three templates and compares it with the configured threshold. Tests compare this implementation with the actual installed Human source.
35. Created `backend/src/auth/` with request DTOs, registration/login services, cookie handling, a JWT session guard, and an origin guard.
36. Added `POST /auth/register`: validate and normalize the request, call the atomic database function, return 409 on duplicate email, then issue a signed JWT in an HTTP-only cookie. Response JSON contains only user ID and email.
37. Added `POST /auth/face-login`: find the claimed email, compare the submitted vector with only that account's stored templates, and create a session only when the backend accepts the match. Wrong faces and unknown emails receive the same 401 message.
38. Added `GET /auth/me`: verify the cookie JWT signature, expiry, issuer, audience, and subject, then load the user. Invalid/missing sessions receive 401. Embeddings are never returned to the browser.
39. Added `POST /auth/logout`: expire the cookie using the same path and cookie settings. The browser's subsequent `/auth/me` request fails.
40. Added bounded JSON request bodies, strict DTO validation, security headers, credentialed CORS for the configured frontend, a required matching Origin on mutations, and request rate limits. Authentication endpoints allow 10 attempts per minute per IP.
41. Added `Cache-Control: no-store` to authentication responses and sanitized database error messages.

## 7. Implemented the reusable browser camera module

42. Created `frontend/src/face/face-engine.ts`, separately from page components. It exports `startCamera()`, `stopCamera()`, `loadModels()`, `detectFace()`, `createEmbedding()`, `captureEnrollmentSamples()`, and `captureLoginSample()`.
43. Used native browser `getUserMedia()` for a video-only camera stream. No microphone access is requested.
44. Configured Human for face detection, rotated face alignment, face mesh, and FaceRes descriptors. Disabled body, hand, object, gesture, emotion, iris, segmentation, liveness, and anti-spoof modules for this scope.
45. Added `quality.ts`: accept exactly one face, sufficient detector/face confidence, a minimum face size, and a complete finite descriptor. Configured detection for up to three faces so multiple people are not silently accepted as one.
46. Registration collects three accepted embeddings spaced at least 900 ms apart; login collects one. Disabled detection/descriptor frame caching and serialized model inference between attempts.
47. Added capture timeout, missing/disconnected camera handling, permission-denied and camera-busy messages, model-loading errors, and retry behavior.
48. Added `use-face-capture.ts` to manage React state, cancellation, progress, and camera cleanup. Tracks stop after capture, errors, cancellation, or leaving the page. A stream that arrives after cancellation is also stopped.
49. Camera frames remain in browser memory for processing. The app does not save or upload photographs. Only numerical descriptors are submitted to NestJS.

## 8. Built the four screens

50. Created `Register`, `Login`, `Dashboard`, and `NotFound` in `frontend/src/pages/`. The root path redirects to Register; unknown paths display Not Found.
51. Created a shared `AuthScreen` component and `CameraPanel` so both authentication pages reuse the same form/capture UI. Page files remain small.
52. Register includes an email field and **Register Face** button. Login includes an email field and **Unlock with Face** button. Both display live capture guidance and sample progress.
53. Dashboard obtains the user from `/auth/me`, displays the email, and offers **Log out**. It rechecks the session on focus, visibility changes, and periodically. It redirects to Login on 401 and shows a retry option for connection errors.
54. Added the shared header/footer, responsive CSS, keyboard focus states, status/error announcements, disabled pending actions, and reduced-motion support. The UI explicitly labels the app as an experiment without liveness/anti-spoofing.
55. Added `frontend/src/lib/api.ts` for REST calls with `credentials: 'include'`, cancellation, timeouts, and consistent error messages. No JWT is stored in JavaScript storage.
56. Configured Vite's `/api` proxy to the local NestJS server. For example, browser `/api/auth/me` reaches Nest's `/auth/me`. Added Vite deny rules for backend files, environment files, Git internals, and the original brief.
57. Set the frontend dev command to use `localhost`, matching the allowed origin. Always open `http://localhost:5173`, not a different hostname, for this configuration. Tested Vite requests for the backend `.env` and the original brief; both returned 403. Scanned frontend source and build output and found no server secret keys or JWT signing secret references.

## 9. Built and tested the project

58. Ran `npm run typecheck` from the main folder; both TypeScript projects passed.
59. Ran `npm run build`; NestJS and Vite production builds passed. Human is a separate lazy-loaded chunk. Vite notes its size because TensorFlow is substantial; this chunk is loaded when capture is requested.
60. Added backend tests for registration/cookies, login matching, mismatches, unknown accounts, incomplete templates, duplicate emails, malformed requests, model versions, origin checks, expired/tampered sessions, deleted users, database errors, exact email lookup, and compatibility with Human's matching implementation.
61. An initial test run hit the real rate limiter during the validation test matrix. Changed the global guard provider to `useExisting`, which lets those tests explicitly substitute the rate limiter. Added a separate test using the real limiter to verify the 11th authentication attempt is rejected.
62. Added isolated test environment settings so the automated tests need no live database credentials. After upgrading to NestJS 12, ran `npm dedupe --cache .npm-cache --no-fund --fetch-retries=0` to remove duplicate framework versions. Enabled Node's `--experimental-vm-modules` flag in the Jest command for the ESM packages and set the root Node engine requirement to **24.9 or newer**. The VM-module experimental notice during tests is expected. Restarted both development servers after the package changes; a live test attempted during that restart could not connect, so I reran it once the final backend was listening.
63. Added frontend tests for quality gates, permission-denied handling, stopping tracks, a camera permission result arriving after cancellation, multiple-face rejection, timed collection of three enrollment samples, one login sample, and capture timeout.
64. Ran `npm test` and corrected the test isolation issue. The final suite covers 28 backend tests and 9 frontend tests.
65. Started both local servers using `npm run dev` from the main folder.
66. Added and ran `npm run test:live`. It used uniquely named synthetic accounts and synthetic vectors in your experimental Supabase project. It verified registration, exactly three numbered templates, normalized email, HTTP-only sessions, duplicate-email rejection, `/auth/me`, logout, failed matching, successful matching, and a transaction rollback caused by an invalid third sample.
67. The live test deleted only its own temporary users and confirmed that their face templates were removed by the foreign-key cascade. It did not enroll a real person's face.
68. Opened the frontend in the browser and visually checked Register. Visited Dashboard without a session and verified the redirect to Login. Visited an unknown URL and verified Not Found.
69. Created a temporary model-check page that loaded the real Human models and ran inference on an empty canvas without accessing the webcam. It reported success with zero faces. Removed that temporary page and closed its browser tab afterward, leaving only the four application screens.
70. Formatted the source, then completed final build/test checks. Left the Register page open for you.
71. Created this file in the main folder, as requested. Did not create a README.

## How to run it

Use Node **24.9 or newer** (this machine already has 24.16.0). From the main folder:

```powershell
cd E:\projects\face-auth-experiment
npm run dev
```

Open **http://localhost:5173**. The backend is at **http://localhost:3000**. Both servers were started during this task; if they are already running, use the existing page instead of starting a second copy. Stop the development command with Ctrl+C when finished.

The root commands use npm workspaces, so you do not have to change folders for installation or normal development. To run the apps separately, use `npm run dev -w frontend` and `npm run dev -w backend` from the root, or `npm run dev` inside each respective folder.

On a fresh checkout, run `npm ci` from the root, create `backend/.env` from `.env.example` with real values, and run the SQL once if that Supabase project does not already have the function. The current local `.env` and your current database are already configured.

Useful commands, all from the main folder:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and backend together |
| `npm run build` | Build both applications |
| `npm run typecheck` | Check both TypeScript projects |
| `npm test` | Run isolated automated tests |
| `npm run check:database` | Check real table/function access without writing an account |
| `npm run test:live` | Test the real API/database using temporary synthetic accounts; servers must be running |
| `npm run models` | Recopy pinned face-model assets |
| `npm run format` | Format the project source |

## Try your actual face and calibrate

I verified the real model runtime and the full API/database flow separately. I did not activate your webcam or enroll your face. Real face accuracy and the threshold still need your physical testing.

1. Open Register, enter an email, click Register Face, and allow camera access.
2. Keep exactly one face in view with good lighting. Wait for all three samples and the Dashboard redirect.
3. Refresh Dashboard to check the persistent cookie session.
4. Log out, then try opening Dashboard directly. It should send you to Login.
5. Log in using the same email and your face. Watch the backend terminal's similarity score.
6. Compare scores under normal lighting, closer/farther positions, and glasses if relevant. With their consent, try a different person's face against your email and confirm rejection.
7. Adjust `FACE_MATCH_THRESHOLD` in `backend/.env` based on these observations and restart the backend. A higher threshold is stricter. Disable `FACE_DEBUG_SCORES` when you no longer need calibration logs.

This intentionally remains an experiment: no liveness, anti-spoofing, email ownership verification, recovery flow, or device-bound capture proof is implemented. An embedding is sensitive biometric data, not a password hash. A malicious client can replay a known valid embedding, and a photo/video attack is outside this prototype's protection. Clearing the cookie logs this browser out; an independently copied JWT remains valid until expiry. The initial threshold is a starting point, not a measured accuracy claim.

For a later deployment, serve the frontend and `/api` behind the same HTTPS origin, set `FRONTEND_ORIGIN` to that origin and `NODE_ENV=production`, and keep the backend behind the reverse proxy. The current backend listens on loopback for local development. Host the built frontend with fallback to `index.html` for its routes. No deployment was requested or performed.

## Source references

- Human embeddings and matching: https://github.com/vladmandic/human/wiki/Embedding
- Human's matching source, also checked in the installed package: https://github.com/vladmandic/human/blob/main/src/face/match.ts
- Supabase database functions: https://supabase.com/docs/guides/database/functions
- Supabase RPC calls: https://supabase.com/docs/reference/javascript/rpc
- NestJS authentication: https://docs.nestjs.com/security/authentication
- NestJS cookies: https://docs.nestjs.com/techniques/cookies
