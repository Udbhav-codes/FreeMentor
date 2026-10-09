/**
 * Opening animation — product plan §5 step 0, screen 1 of the preview.
 *
 *   "After the Android 12+ system splash: a dotted route draws itself to an
 *    amber flag, the FreeMentor wordmark and tagline fade in. ~1.2 s on first
 *    launch, 0.4 s afterwards, skippable."
 *
 * The route drawing to a flag IS the product's core metaphor (a Personal
 * Learning GPS), so it earns its 1.2 seconds exactly once. Every launch after
 * that it is nearly instant, and a tap always skips it — an animation a
 * returning learner cannot get past is just a delay.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import { palette } from '../theme/tokens.ts';
import { Txt } from './ui.tsx';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const FIRST_LAUNCH_MS = 1200;
const RETURNING_MS = 400;

/** The dotted route, in a 240x180 box. */
const ROUTE = 'M 24 156 C 70 150, 60 96, 104 92 S 150 70, 196 28';
const ROUTE_LENGTH = 260;

export function OpeningAnimation({
  firstLaunch,
  onDone,
}: {
  firstLaunch: boolean;
  onDone: () => void;
}) {
  const { width } = useWindowDimensions();
  const duration = firstLaunch ? FIRST_LAUNCH_MS : RETURNING_MS;

  const draw = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  // Guard so a tap and the timer cannot both fire onDone.
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(draw, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: Math.round(duration * 0.6),
        delay: Math.round(duration * 0.4),
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished: ok }) => {
      if (ok) finish();
    });

    // Belt and braces: if the animation is interrupted (backgrounded mid-run)
    // the app must still get past this screen.
    const timer = setTimeout(finish, duration + 600);
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const size = Math.min(280, width - 80);
  const offset = draw.interpolate({
    inputRange: [0, 1],
    outputRange: [ROUTE_LENGTH, 0],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Skip intro"
      onPress={finish}
      style={{
        flex: 1,
        backgroundColor: palette.navy,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
      }}
    >
      <Svg width={size} height={size * 0.75} viewBox="0 0 240 180">
        <AnimatedPath
          d={ROUTE}
          stroke="#FFFFFF"
          strokeOpacity={0.9}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="2 10"
          strokeDashoffset={offset}
        />
        {/* start pin */}
        <Circle cx={24} cy={156} r={7} fill="#FFFFFF" />
        {/* the flag you are heading for */}
        <Rect x={194} y={10} width={3} height={30} fill={palette.amber} rx={1.5} />
        <Polygon points="197,12 219,20 197,28" fill={palette.amber} />
      </Svg>

      <Animated.View style={{ opacity: fade, alignItems: 'center', gap: 8 }}>
        <Txt variant="display" style={{ color: '#FFFFFF' }}>
          FreeMentor
        </Txt>
        <View style={{ alignItems: 'center' }}>
          <Txt variant="small" style={{ color: '#C9D4EE' }}>
            Free resources. Clear roadmap.
          </Txt>
          <Txt variant="small" style={{ color: '#C9D4EE' }}>
            Every day.
          </Txt>
        </View>
      </Animated.View>
    </Pressable>
  );
}
