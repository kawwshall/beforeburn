# Lab 13 — Welcome screen and authentication navigation

## Objective

Replace the Expo starter entry point with beforeburn’s Welcome screen and create the navigation structure for sign-in, account creation, onboarding, and the signed-in tab app.

## User flow

```text
Welcome
  ├── Create account → Create account screen
  ├── Sign in       → Sign-in screen
  └── Explore       → Plan tab preview
```

In this lab, buttons navigate between screens. A later lab connects the forms to Supabase Auth.

## Concepts

| Concept | Meaning |
| --- | --- |
| Stack navigation | Screens placed on top of one another; users can go forward and back. |
| Route group | Parentheses in Expo Router folder names organize routes without adding URL path text. |
| `router.push` | Move forward to another route and keep a back history. |
| `router.replace` | Move to another route without allowing a return to the previous screen. |
| Controlled input | A text field whose value is stored in React state. |

## Steps

### 1. Simplify the root navigator

Replace `app/_layout.tsx` with:

```tsx
import { Stack } from 'expo-router';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```

The root stack decides which major area is visible. It does not decide whether a user is authenticated yet; that decision will come after real sign-in exists.

### 2. Create the Welcome route

Create `app/index.tsx`:

```tsx
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, radius, spacing, type } from '@/constants/theme';

export default function WelcomeScreen() {
  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.mark}>
          <Text style={styles.markText}>○</Text>
        </View>
        <Text style={styles.eyebrow}>beforeburn</Text>
        <Text style={styles.title}>Plan your energy,{"\n"}not just your time.</Text>
        <Text style={styles.subtitle}>
          See busy days early. Make room to recover.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          style={styles.primaryButton}
          onPress={() => router.push('/create-account')}>
          <Text style={styles.primaryButtonText}>Create account</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.secondaryButton}
          onPress={() => router.push('/sign-in')}>
          <Text style={styles.secondaryButtonText}>Sign in</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.textButton}>Explore prototype</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
  },
  content: {
    alignItems: 'center',
    marginTop: spacing.hero,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: colors.mist,
    borderRadius: radius.sheet,
    height: 72,
    justifyContent: 'center',
    marginBottom: spacing.xl,
    width: 72,
  },
  markText: {
    color: colors.primaryDeep,
    fontSize: type.display,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: type.bodySmall,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: type.display,
    fontWeight: '700',
    lineHeight: 46,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: type.body,
    lineHeight: 24,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.md,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: type.body,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.primaryDeep,
    fontSize: type.body,
    fontWeight: '700',
  },
  textButton: {
    color: colors.primary,
    fontSize: type.bodySmall,
    fontWeight: '600',
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
});
```

### 3. Create the auth route group

Create `app/(auth)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Create `app/(auth)/sign-in.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/Screen';
import { colors, radius, spacing, type } from '@/constants/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Account</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Your plan stays private and synced.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={email}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          accessibilityLabel="Password"
          autoComplete="current-password"
          onChangeText={setPassword}
          placeholder="Your password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable accessibilityRole="button" style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/create-account')}>
          <Text style={styles.textButton}>Need an account? Create one</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.primary, fontSize: type.body, fontWeight: '600' },
  content: { flex: 1, justifyContent: 'center' },
  eyebrow: {
    color: colors.primary,
    fontSize: type.bodySmall,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: type.display, fontWeight: '700', marginTop: spacing.sm },
  subtitle: { color: colors.textMuted, fontSize: type.body, lineHeight: 24, marginTop: spacing.sm },
  label: { color: colors.text, fontSize: type.bodySmall, fontWeight: '700', marginTop: spacing.xl },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: type.body,
    marginTop: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: spacing.xxl,
    minHeight: 52,
  },
  primaryButtonText: { color: colors.surface, fontSize: type.body, fontWeight: '700' },
  textButton: { color: colors.primary, fontSize: type.bodySmall, fontWeight: '600', marginTop: spacing.lg, textAlign: 'center' },
});
```

## Inspect and predict

1. Why use `router.push` for sign-in but `router.replace` for the prototype tab preview?
2. Why is `password` stored with `useState` but never sent anywhere in this lab?
3. Which style values came from the shared theme instead of being invented in the screen?

## Verify

Run:

```bash
npx tsc --noEmit
npx expo start --web
```

Check:

- Welcome screen opens at `/`.
- Sign in navigates to the sign-in screen.
- Back returns to Welcome.
- Input text changes as you type.
- Create account is not expected to work until the next lab creates that screen.

## What you learned

The route structure describes user journeys. Screens own visual state such as input text; later, a service will handle network state such as signing in. Keeping those concerns separate makes authentication easier to test and change.

