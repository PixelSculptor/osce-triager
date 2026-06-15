export function Pill() {
  return (
    <g
      transform='translate(870 155) rotate(30)'
      opacity='0.2'
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
