import React from 'react';

export function Sparkline({ values = [], color = 'var(--wellpath-accent)', width = 104, height = 32 }) {
  const nums = values.map(Number).filter((v) => Number.isFinite(v));
  if (nums.length < 2) {
    return <span className="sparkline-empty">not enough data</span>;
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const pad = 3;
  const points = nums
    .map((v, i) => {
      const x = (i / (nums.length - 1)) * width;
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastX = width;
  const lastY = height - pad - ((nums[nums.length - 1] - min) / span) * (height - pad * 2);

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.4" fill={color} />
    </svg>
  );
}

export default Sparkline;
