/**
 * "Building your personalised roadmap…" — product plan §5 step 11.
 *
 * The five lines §5 names, ticking off one at a time:
 *   Analysing your goal → Calculating your available time → Planning your
 *   learning sequence → Selecting resources → Creating your roadmap.
 *
 * The scheduler actually finishes in milliseconds, so this is honest-but-paced
 * rather than a fake loading bar: each line names something the app really did
 * a moment ago. It exists because a plan that appears instantly reads as
 * canned, and this one genuinely is personal.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Screen, Txt } from './ui.tsx';
import { useTheme } from '../theme/ThemeProvider.tsx';

const STEPS = [
  'Analysing your goal',
  'Calculating your available time',
  'Planning your learning sequence',
  'Selecting resources',
  'Creating your roadmap',
];

const STEP_MS = 420;

export function Building({ goalName, onDone }: { goalName: string; onDone: () => void }) {
  const theme = useTheme();
  const [done, setDone] = useState(0);
  const finished = useRef(false);

  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setDone(i + 1), STEP_MS * (i + 1)),
    );
    const final = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onDone();
    }, STEP_MS * STEPS.length + 350);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(final);
    };
  }, [onDone]);

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.xl,
          gap: theme.spacing.xl,
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Txt variant="display">Building your roadmap…</Txt>
          <Txt variant="small" color="secondary">
            {goalName}
          </Txt>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {STEPS.map((step, i) => (
            <StepLine key={step} label={step} state={i < done ? 'done' : i === done ? 'active' : 'idle'} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function StepLine({
  label,
  state,
}: {
  label: string;
  state: 'idle' | 'active' | 'done';
}) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (state !== 'active') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        opacity: state === 'idle' ? 0.35 : state === 'active' ? pulse : 1,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: state === 'done' ? theme.colors.primary : 'transparent',
          borderWidth: state === 'done' ? 0 : 2,
          borderColor: theme.colors.muted,
        }}
      >
        {state === 'done' ? (
          <Txt variant="caption" color="onPrimary">
            ✓
          </Txt>
        ) : null}
      </View>
      <Txt variant="body">{label}</Txt>
    </Animated.View>
  );
}
