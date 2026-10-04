# Lab 31 — Build the Cosmic Drift recovery player

## Goal

Build the interactive audio recovery activity with accessible controls, lifecycle updates, and interruption handling.

## Before you start

Complete Labs 28–29. Have a licensed audio asset and a scheduled recovery session. Check the Expo SDK version in `apps/mobile/package.json` before installing native modules.

## 1. Define player states

Use states `ready`, `playing`, `paused`, `completed`, and `cancelled`. Keep allowed transitions in a small pure function and test them. The server session status is authoritative for scheduled recovery lifecycle; playback time and sound controls are local presentation state.

## 2. Add player screen

Create `apps/mobile/app/recovery-player.tsx`. Read the scheduled recovery ID from the route, fetch its catalogue item, and show title, elapsed time, progress, and large Play/Pause/Finish/Cancel buttons. Use the existing theme tokens and a `Screen` wrapper. Do not begin audio until the person presses Play.

Keep transitions in a pure helper such as `apps/mobile/lib/playerState.ts`:

```ts
type PlayerState = 'ready' | 'playing' | 'paused' | 'completed' | 'cancelled';

const transitions: Record<PlayerState, PlayerState[]> = {
  ready: ['playing', 'cancelled'],
  playing: ['paused', 'completed', 'cancelled'],
  paused: ['playing', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canMove(from: PlayerState, to: PlayerState) {
  return transitions[from].includes(to);
}
```

Terminal states have no outgoing transition; this prevents a completed activity from accidentally restarting its server lifecycle.

## 3. Add audio asset and playback

Use a licensed local audio file or an approved hosted asset; document its source. Install the Expo package compatible with the project's SDK:

```bash
cd apps/mobile
npx expo install expo-audio
```

To keep the lesson buildable before the licensed audio asset is selected, add this public, non-secret value to `apps/mobile/.env.example` and the ignored local `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_RECOVERY_AUDIO_URL=
```

Paste the HTTPS URL of the licensed audio file into the local `.env`. The app displays a text-only fallback until that asset exists. Do not copy audio from a streaming service or commit a file whose license is unclear.

Create `apps/mobile/components/RecoveryAudioControls.tsx`:

```tsx
import { AppState, Button, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef } from 'react';

const source = process.env.EXPO_PUBLIC_RECOVERY_AUDIO_URL || null;

export function RecoveryAudioControls({ onPlay, onPause, onFinished }: {
  onPlay: () => Promise<boolean>; onPause: () => void; onFinished: () => void;
}) {
  const player = useAudioPlayer(source, { updateInterval: 1000 });
  const status = useAudioPlayerStatus(player);
  const finishedRef = useRef(false);
  useEffect(() => {
    if (status.didJustFinish && !finishedRef.current) {
      finishedRef.current = true;
      onFinished();
    }
  }, [status.didJustFinish, onFinished]);
  useEffect(() => () => player.pause(), [player]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && status.playing) { player.pause(); onPause(); }
    });
    return () => subscription.remove();
  }, [player, status.playing, onPause]);
  if (!source) return <Text>Audio is not available. You can still use the written recovery steps.</Text>;
  if (status.error) return <Text accessibilityRole="alert">Audio could not be loaded. Try again later.</Text>;
  return (
    <View>
      <Text>{status.isLoaded ? `${Math.floor(status.currentTime)} seconds elapsed` : 'Loading audio'}</Text>
      <Button
        title={status.playing ? 'Pause' : 'Play'}
        disabled={!status.isLoaded}
        onPress={() => {
          if (status.playing) { player.pause(); onPause(); }
          else { void onPlay().then((allowed) => { if (allowed) player.play(); }); }
        }}
      />
    </View>
  );
}
```

Create `apps/mobile/app/recovery-player.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { apiFetch, publicApiFetch } from '../lib/api';
import type { RecoveryCatalogueItem } from '../types/recovery';
import { RecoveryAudioControls } from '../components/RecoveryAudioControls';

type Session = { id: string; catalogue_item_id: string; status: string };

export default function RecoveryPlayerScreen() {
  const { recoveryId } = useLocalSearchParams<{ recoveryId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [item, setItem] = useState<RecoveryCatalogueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingCompletion, setPendingCompletion] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [sessionsResponse, catalogueResponse] = await Promise.all([
        apiFetch('/me/recoveries'), publicApiFetch('/recoveries'),
      ]);
      if (!sessionsResponse.ok) throw new Error('Session unavailable');
      const sessions = await sessionsResponse.json() as Session[];
      const activities = await catalogueResponse.json() as RecoveryCatalogueItem[];
      const found = sessions.find((row) => row.id === recoveryId);
      if (!found) throw new Error('Recovery session not found');
      const activity = activities.find((row) => row.id === found.catalogue_item_id);
      if (!activity) throw new Error('Recovery activity not found');
      setSession(found); setItem(activity);
    } catch { setError('Could not load this recovery. Return and try again.'); }
    finally { setLoading(false); }
  }, [recoveryId]);
  useEffect(() => { void load(); }, [load]);

  const updateStatus = useCallback(async (status: 'started' | 'completed' | 'cancelled') => {
    if (!session) return false;
    try {
      const response = await apiFetch(`/me/recoveries/${session.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) return false;
      setSession(await response.json() as Session);
      return true;
    } catch { return false; }
  }, [session]);

  async function finish() {
    if (session?.status === 'accepted' && !(await updateStatus('started'))) {
      setError('Could not start this recovery. Try again.');
      return;
    }
    if (await updateStatus('completed')) { setPendingCompletion(false); router.back(); }
    else setPendingCompletion(true);
  }
  async function cancel() {
    if (await updateStatus('cancelled')) router.back();
    else setError('Could not cancel this session. Retry.');
  }
  if (loading) return <ActivityIndicator accessibilityLabel="Loading recovery" />;
  if (error && !session) return <View><Text accessibilityRole="alert">{error}</Text>
    <Pressable accessibilityRole="button" onPress={() => void load()}><Text>Retry</Text></Pressable></View>;
  if (!session || !item) return null;
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 20 }}>
    <Text accessibilityRole="header">{item.title}</Text>
    <Text>{item.description}</Text>
    <Text>{item.duration_minutes} minutes</Text>
    {session.status === 'completed' ? <Text>Recovery completed.</Text> :
      session.status === 'cancelled' ? <Text>Recovery cancelled.</Text> : <>
        <RecoveryAudioControls
          onPlay={async () => session.status !== 'accepted' || await updateStatus('started')}
          onPause={() => {}}
          onFinished={() => void finish()}
        />
        <Pressable accessibilityRole="button" onPress={() => void finish()}><Text>Finish recovery</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void cancel()}><Text>Cancel recovery</Text></Pressable>
      </>}
    {pendingCompletion && <View>
      <Text accessibilityRole="alert">Audio ended, but completion was not saved.</Text>
      <Pressable accessibilityRole="button" onPress={() => void finish()}><Text>Retry save</Text></Pressable>
    </View>}
    {error !== '' && <Text accessibilityRole="alert">{error}</Text>}
  </View>;
}
```

This implementation updates the server lifecycle only after the server confirms. The player itself pauses when the screen unmounts and its hook releases the native player. For apps that must keep audio playing after the screen closes, separately configure the Expo Audio background plugin and test a development build.

Keep playback behind this component so the player can be replaced without rewriting the screen. The hook releases its player when the component unmounts; the cleanup pauses first. The completion callback persists the session using the server route from Lab 29. Expo's [Audio SDK documentation](https://docs.expo.dev/versions/latest/sdk/audio/) defines the status and lifecycle methods used here.

## 4. Accessibility and interruptions

Give controls labels such as “Pause Cosmic Drift” and “Finish recovery.” Respect the user's reduced-motion preference. Listen for audio interruptions/app background state and pause or duck audio according to platform behavior. Provide a non-audio description so the activity is not inaccessible to deaf users.

## 5. Persist completion

When audio ends, call the protected recovery status endpoint to mark completed. If that request fails, retain a pending completion state and offer retry; do not tell the user the session was recorded before the API confirms it.

## Verify

Test load failure, play/pause, backgrounding, interruption, natural completion, manual finish, cancel, and a server failure during completion. Verify screen reader control labels.

## Exercise

Add an elapsed-time announcement no more than once per minute so a screen reader is not interrupted every second.

## Common mistakes

- Audio starts on screen open: wait for the person's Play action.
- Player continues after navigating away: stop/release player when the screen unmounts.
- Completion is shown before server save: keep a pending state and retry on API failure.

## Commit

```bash
git add apps/mobile services/api/app services/api/tests docs/labs/31-cosmic-drift-player.md
git commit -m "feat(mobile): add recovery audio player"
git push
```
