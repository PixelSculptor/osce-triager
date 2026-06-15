interface PillProps {
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
  opacity?: number;
}

export function Pill({
  x = 870,
  y = 155,
  rotation = 30,
  scale = 1,
  opacity = 0.2,
}: PillProps) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}
      opacity={opacity}
      stroke='currentColor'
      strokeWidth='2.5'
      fill='none'
      strokeLinecap='round'
    >
      {/* Capsule outline */}
      <rect x='-72' y='-28' width='144' height='56' rx='28' />
      {/* Center seam dividing the two halves */}
      <line x1='0' y1='-28' x2='0' y2='28' />
    </g>
  );
}
