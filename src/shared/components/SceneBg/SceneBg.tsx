import { EcgTrace } from './EcgTrace';
import { GeometricShapes } from './GeometricShapes';
import { Pill } from './Pill';
import { Syringe } from './Syringe';

export function SceneBg() {
  return (
    <div aria-hidden='true' className='scene-bg'>
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 1440 900'
        preserveAspectRatio='xMidYMid slice'
        width='100%'
        height='100%'
        fill='none'
        aria-hidden='true'
      >
        <GeometricShapes />
        <EcgTrace />
        <Pill />
        <Syringe />
      </svg>
    </div>
  );
}
