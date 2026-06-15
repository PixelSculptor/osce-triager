interface SyringeProps {
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
  opacity?: number;
}

export function Syringe({
  x = 1310,
  y = 460,
  rotation = -40,
  scale = 1,
  opacity = 0.18,
}: SyringeProps) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}
      opacity={opacity}
      stroke='currentColor'
      strokeWidth='2'
      fill='none'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      {/* Plunger head */}
      <rect x='-138' y='-24' width='20' height='48' rx='3' />
      {/* Plunger rod */}
      <line x1='-118' y1='0' x2='-65' y2='0' />
      {/* Finger flanges */}
      <line x1='-60' y1='-26' x2='-60' y2='26' />
      {/* Barrel */}
      <rect x='-63' y='-17' width='126' height='34' rx='6' />
      {/* Graduation marks */}
      <line x1='-20' y1='-17' x2='-20' y2='-10' strokeWidth='1.5' />
      <line x1='5' y1='-17' x2='5' y2='-10' strokeWidth='1.5' />
      <line x1='30' y1='-17' x2='30' y2='-10' strokeWidth='1.5' />
      {/* Needle hub */}
      <path d='M 63,-12 L 80,-5 L 80,5 L 63,12 Z' />
      {/* Needle */}
      <line x1='80' y1='0' x2='148' y2='0' strokeWidth='1.5' />
    </g>
  );
}
