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

        {/* Pill — main instance, upper-center-right */}
        <Pill x={870} y={155} rotation={30} scale={1} opacity={0.2} />
        {/* Pill — small, left-center */}
        <Pill x={185} y={365} rotation={-18} scale={0.55} opacity={0.16} />
        {/* Pill — small, lower-right */}
        <Pill x={1210} y={778} rotation={48} scale={0.5} opacity={0.15} />
        {/* Pill — tiny, bottom-center */}
        <Pill x={690} y={858} rotation={-32} scale={0.42} opacity={0.14} />

        {/* Syringe — main instance, right-center */}
        <Syringe x={1310} y={460} rotation={-40} scale={1} opacity={0.18} />
        {/* Syringe — small, upper-center, steeply angled */}
        <Syringe x={630} y={125} rotation={68} scale={0.52} opacity={0.15} />
        {/* Syringe — small, lower-left area */}
        <Syringe x={320} y={760} rotation={-22} scale={0.48} opacity={0.14} />
      </svg>
    </div>
  );
}
