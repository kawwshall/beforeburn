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