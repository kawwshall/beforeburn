# Lab 11 — Expo mobile foundation

## Objective

Create the beforeburn mobile application inside the repository. Run the same TypeScript codebase as an iOS app, Android app, and web preview.

## Sprint outcome

This begins the complete Account and Preferences product area. By the end of this sprint, a user will be able to move through welcome, sign-in, onboarding, and preferences screens; the backend will protect and store their preferences.

## Why Expo and React Native?

```text
One TypeScript codebase
        ↓
iOS app · Android app · Web preview
```

React Native gives JavaScript/TypeScript code native mobile components such as `View`, `Text`, and `Pressable`. Expo supplies the development tools, device APIs, and cross-platform configuration around React Native.

The web preview is useful for fast development and teaching. It is not the primary product target; beforeburn is designed mobile-first.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Component | A reusable piece of screen UI written in TypeScript/React. |
| Screen | One navigable app view, such as Welcome or Plan. |
| Route | The file/path that selects a screen. |
| Expo Router | File-based navigation for Expo applications. |
| Tab navigation | Persistent top-level destinations, such as Plan, Recovery, and You. |
| Hot reload | Update the app after saving without a full rebuild. |

## Prerequisites

- Node.js and npm installed.
- VS Code open at the repository root.
- An iPhone/Android with Expo Go is optional but useful.

Expo recommends a Node.js LTS version. If the project scaffold reports a Node compatibility error, install/use the current LTS version before continuing rather than trying to work around the error.

## Steps

### 1. Create the mobile project

From the repository root, run:

```bash
npx create-expo-app@latest apps/mobile --template tabs --no-agents-md
```

Why this command:

| Part | Meaning |
| --- | --- |
| `npx` | Runs a package tool without globally installing it. |
| `create-expo-app@latest` | Uses the current official Expo project generator. |
| `apps/mobile` | Places the mobile app in the planned monorepo location. |
| `--template tabs` | Creates TypeScript, Expo Router, and an initial tab-navigation structure. |
| `--no-agents-md` | Avoids adding generated agent-only instructions to this teaching repository. |

### 2. Inspect the generated project

The new project contains files similar to:

```text
apps/mobile/
  app/             Route files; each screen is a file
  components/      Reusable UI pieces
  assets/          Images, fonts, and other static assets
  package.json     JavaScript dependencies and scripts
  app.json         App name, icon, and platform configuration
```

Do not delete generated files yet. First run the untouched project successfully.

### 3. Run the web preview

```bash
cd apps/mobile
npx expo start --web
```

Expo opens a browser preview. Save a harmless visible text change in one generated screen, then watch hot reload update the browser.

Stop the development server with `Ctrl + C`.

### 4. Optional: run on a physical phone

1. Install **Expo Go** from the App Store or Google Play.
2. Run `npx expo start`.
3. Scan the QR code from the terminal/browser.

The phone and computer usually need to be on the same network. This is development preview, not an App Store build.

### 5. Commit the scaffold

From the repository root:

```bash
cd ../..
git status
```

Review the generated files. `node_modules/` must not appear because it is ignored. Then commit:

```bash
git add apps/mobile
git commit -m "feat(mobile): scaffold Expo application"
git push
```

## Inspect before changing

Open `apps/mobile/package.json` and answer:

1. Which command starts the app?
2. Which package provides Expo Router?
3. Why is `node_modules/` omitted from Git while `package.json` is committed?

## Independent exercise

Find the generated tab labels and change one label to `Plan preview`. Do not rename folders or delete a route. Confirm the change appears in the web preview, then return it to its original label.

## What you learned

Scaffolding is not “magic app creation.” It creates a known directory structure, dependency list, and development configuration so the team can focus on product components rather than rebuilding mobile tooling for every project.

## Reference

[Expo: Create a project](https://docs.expo.dev/get-started/create-a-project/)

