export function GeometricShapes() {
  return (
    <>
      {/* Large ring — top-right, partially outside viewport */}
      <circle
        cx='1390'
        cy='-70'
        r='340'
        stroke='currentColor'
        strokeWidth='3'
        opacity='0.22'
      />
      {/* Medium ring — top-left edge */}
      <circle
        cx='-40'
        cy='130'
        r='200'
        stroke='currentColor'
        strokeWidth='2.5'
        opacity='0.18'
      />
      {/* Small filled circle — left-center edge */}
      <circle cx='-20' cy='460' r='55' fill='currentColor' opacity='0.14' />
      {/* Large filled circle — bottom-right, mostly outside */}
      <circle cx='1420' cy='870' r='190' fill='currentColor' opacity='0.12' />
      {/* Small filled circle — bottom-left */}
      <circle cx='100' cy='840' r='38' fill='currentColor' opacity='0.18' />
      {/* Rotated square — upper-left area */}
      <rect
        x='110'
        y='55'
        width='105'
        height='105'
        rx='8'
        transform='rotate(22 162 107)'
        fill='currentColor'
        opacity='0.12'
      />
      {/* Small ring — bottom-center */}
      <circle
        cx='690'
        cy='930'
        r='110'
        stroke='currentColor'
        strokeWidth='2'
        opacity='0.14'
      />
    </>
  );
}
