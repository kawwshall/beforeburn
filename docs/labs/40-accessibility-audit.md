# Lab 40 — Audit and improve app accessibility

## Goal

Make the core flows usable with screen readers, larger text, reduced motion, and varied motor or sensory needs. Accessibility is part of feature completion, not polish at the end.

## Before you start

Complete Labs 13–39 for the implemented screens. If a feature is not built yet, record it as pending instead of marking its audit passed.

## 1. Prepare a flow checklist

Audit Welcome/sign-in, onboarding, Plan day, check-in, recovery player, timer, Settings, export, and deletion. For each screen record: visible label, accessibility label/role, focus order, touch target, contrast, large-text behavior, motion, and error announcement.

## 2. Test with platform tools

On iOS, enable VoiceOver and Dynamic Type; on Android, enable TalkBack and font scaling. Test actual device/simulator behavior. Automated lint checks can find missing labels but cannot prove the flow makes sense.

## 3. Fix reusable components first

Review buttons, switches, form fields, cards, and dialogs. Add `accessibilityRole`, labels, and hints where needed. Ensure selected state is spoken. Keep touch targets large enough, avoid conveying information with color alone, and allow content to scroll when text grows.

Example for one choice in the 1–5 check-in control:

```tsx
<Pressable
  accessibilityRole="radio"
  accessibilityState={{ checked: selectedScore === score }}
  accessibilityLabel={`Energy ${score} out of 5`}
  onPress={() => setSelectedScore(score)}
  style={styles.ratingOption}
>
  <Text>{score}</Text>
</Pressable>
```

Group the controls with a label that explains what the scale measures. If the same component runs on web, also support keyboard arrows for the radio group.

## 4. Respect reduced motion and interruption

Use the saved preference and OS accessibility setting to reduce nonessential animation. Ensure audio pauses or yields during calls/alarms. Provide text alternatives for audio-only guidance.

## 5. Verify

Have another person follow the critical flow with the screen reader without visual coaching. Record specific blockers and fix them. Re-run normal visual flow after accessibility changes.

## Exercise

Audit the check-in control. Write the label, role, selected-state announcement, and error announcement before changing code.

## Common mistakes

- Automated scan is treated as full approval: manually complete a flow with a screen reader.
- Selected option only changes color: expose selected state and descriptive text.
- Large text clips a fixed-height screen: allow vertical scrolling and flexible sizing.

## Commit

```bash
git add apps/mobile docs/labs/40-accessibility-audit.md
git commit -m "fix: improve app accessibility"
git push
```
