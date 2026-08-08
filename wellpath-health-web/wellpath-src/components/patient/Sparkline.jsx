import React, { useId, useMemo } from 'react';

function buildSparkline(data = []) {
  const values = data.map(Number).filter(Number.isFinite);
  const fallback = { linePoints: '8,30 92,30', areaPoints: '8,52 8,30 92,30 92,52' };

  if (!values.length) return fallback;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const left = 8;
  const right = 92;
  const top = 10;
  const bottom = 50;
  const width = right - left;
  const height = bottom - top;

  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : left + (index / (values.length - 1)) * width;
    const y = bottom - ((value - min) / range) * height;
    return `${Number(x.toFixed(1))},${Number(y.toFixed(1))}`;
  });

  return {
    linePoints: points.join(' '),
    areaPoints: `${left},${bottom + 2} ${points.join(' ')} ${right},${bottom + 2}`,
  };
}
export function Sparkline({ data, color, compact = false }) {
  const { linePoints, areaPoints } = useMemo(() => buildSparkline(data), [data]);
  const gradientId = useId().replace(/:/g, '');
  const lastPoint = linePoints.split(' ').pop()?.split(',') || ['92', '30'];

  return (
    <svg className={compact ? 'mini-line compact' : 'mini-line'} viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-fill-${gradientId}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line className="spark-grid" x1="8" x2="92" y1="50" y2="50" />
      <line className="spark-grid mid" x1="8" x2="92" y1="30" y2="30" />
      <polygon className="spark-area" points={areaPoints} fill={`url(#spark-fill-${gradientId})`} />
      <polyline className="spark-line-shadow" points={linePoints} />
      <polyline className="spark-line" points={linePoints} style={{ stroke: color }} />
      <circle className="spark-end" cx={lastPoint[0]} cy={lastPoint[1]} r="2.4" style={{ fill: color }} />
    </svg>
  );
}
