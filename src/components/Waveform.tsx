import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../theme';

interface WaveformProps {
  samples: number[];
  live: boolean;
  reduceMotion: boolean;
  height?: number;
}

const WIDTH = 300;

export function Waveform({ samples, live, height = 84 }: WaveformProps) {
  const points = useMemo(() => {
    if (live && samples.length > 1) return samples;
    return Array.from({ length: 64 }, (_, index) => Math.sin(index * 0.28) * 0.08);
  }, [live, samples]);

  const path = useMemo(() => toPath(points, height), [points, height]);

  return (
    <View style={[styles.wrap, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        <Path d={`M 0 ${height / 2} H ${WIDTH}`} stroke="rgba(244,239,230,0.12)" strokeWidth="1" />
        <Path
          d={path}
          stroke={live ? theme.receiver : 'rgba(244,239,230,0.35)'}
          strokeWidth={live ? 3.2 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

function toPath(samples: number[], height: number): string {
  if (samples.length < 2) return '';
  const mid = height / 2;
  const step = WIDTH / (samples.length - 1);
  const points = samples.map((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    return {
      x: index * step,
      y: mid - clamped * (mid - 8),
    };
  });
  let path = `M ${points[0]?.x ?? 0} ${points[0]?.y ?? mid}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (!current || !next) continue;
    const x = (current.x + next.x) / 2;
    const y = (current.y + next.y) / 2;
    path += ` Q ${current.x} ${current.y} ${x} ${y}`;
  }
  const last = points[points.length - 1];
  if (last) path += ` L ${last.x} ${last.y}`;
  return path;
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 4,
  },
});
