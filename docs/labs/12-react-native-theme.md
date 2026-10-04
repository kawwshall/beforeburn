# Lab 12 — Port the design system to React Native

## Objective

Translate the approved beforeburn design tokens into a small typed TypeScript theme that React Native screens can share.

## Why this is not a CSS copy-paste

The existing `design-system/tokens.css` is the visual source of truth for the web prototype. React Native does not use CSS files or CSS custom properties in the same way. Instead, components receive JavaScript style objects.

```text
CSS token:             --paper: #F7FAF9
React Native token:    colors.paper = "#F7FAF9"
```

The design decision stays the same; only the technical representation changes.

## Concepts

| Concept | Meaning |
| --- | --- |
| Design token | A named reusable visual decision: colour, space, font size, radius. |
| Theme | A grouped set of tokens used by components. |
| Semantic token | A name based on purpose (`textMuted`) rather than raw colour (`grey500`). |
| `StyleSheet.create` | React Native helper that validates and organizes static style objects. |
| Platform component | A native UI building block, such as `View`, `Text`, or `Pressable`. |

## Steps

### 1. Create the theme file

Create `apps/mobile/constants/theme.ts`:

```typescript
export const colors = {
  paper: '#F7FAF9',
  surface: '#FFFFFF',
  text: '#142125',
  textMuted: '#52646B',
  border: '#DCE6E5',
  mist: '#EAF3F3',
  primary: '#3F7182',
  primaryDeep: '#19313A',
  night: '#080D1E',
  safe: '#DCEBE4',
  warning: '#F2EAD8',
  warningText: '#6E5830',
  danger: '#A8423F',
  lavender: '#9BA9D4',
  forest: '#365C54',
  chant: '#765F78',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  hero: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  sheet: 24,
} as const;

export const type = {
  caption: 12,
  bodySmall: 14,
  body: 16,
  heading: 24,
  display: 38,
} as const;
```

### Code walkthrough

| Code | Meaning |
| --- | --- |
| `colors.primary` | The beforeburn action colour, formerly CSS `--blue`. |
| `spacing` | A 4-point scale. Screens should prefer these names over random values. |
| `as const` | Makes token values read-only and gives TypeScript precise types. |
| semantic names | `textMuted` tells the next developer why a colour is used. |

### 2. Build a small reusable screen wrapper

Create `apps/mobile/components/Screen.tsx`:

```tsx
import { PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet, ViewStyle } from 'react-native';

import { colors, spacing } from '@/constants/theme';

type ScreenProps = PropsWithChildren<{
  style?: ViewStyle;
}>;

export function Screen({ children, style }: ScreenProps) {
  return <SafeAreaView style={[styles.screen, style]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing.xl,
  },
});
```

### Why use a wrapper?

Every beforeburn screen needs a safe area, paper background, and consistent outer spacing. Writing those three rules in every file causes visual drift. `Screen` centralizes the shared rule while allowing each screen to add its own style.

### 3. Verify TypeScript and the app

From `apps/mobile`, run:

```bash
npx tsc --noEmit
npx expo start --web
```

The starter app should still run unchanged because this lab only adds reusable building blocks.

### Troubleshooting — generated `ExternalLink` type error

Some current Expo Router tab templates type the generated `ExternalLink` component's `href` as a plain `string`, while `Link` expects Expo Router's more specific `Href` type. If `npx tsc --noEmit` reports that `string` is not assignable to `Href`, update `components/ExternalLink.tsx`:

```tsx
import { Href, Link } from 'expo-router';
```

Then change the prop type from:

```tsx
{ href: string }
```

to:

```tsx
{ href: Href }
```

This preserves route type checking instead of bypassing it with `any` or disabling TypeScript checks.

## Independent exercise

Add a `shadow` token object for card shadows. Use it in one temporary `View` in a generated screen, then remove the temporary view after observing the result.

Think about why shadows should be a token: inconsistent shadows are as visually distracting as inconsistent colours.

## What you learned

A design system is not a collection of pretty screens. It is a small set of shared decisions that make future screens consistent, faster to build, and easier to change.
