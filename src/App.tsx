/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppScreenState, OpticsState } from './types/optics';
import { calculateOptics } from './utils/opticsMath';
import { OpticsScene3D } from './components/OpticsScene3D';
import { ControlOverlay } from './components/ControlOverlay';
import { labAudio } from './utils/audio';

const INITIAL_OPTICS_STATE: OpticsState = {
  experimentMode: 'laser_rays',
  lensProfileId: 'conv_10',
  lensType: 'converging',
  focalLength: 10,
  refractiveIndex: 1.5,
  powerOn: true,
  voltage: 12,
  psuPos: [-39, 14.5],
  lensBoxPos: [-12, 14.5],
  lampPos: -36,
  objectPos: -20,
  lensPos: 0,
  screenPos: 10,
  beamMode: 'triple',
  rayOffsetY: 0,
  rayAngleDeg: 0,
  showPhotons: true,
  showVirtualRays: true,
  showLabels: true,
  cameraPreset: 'overview',
  muted: false,
  activePresetId: 'rays_conv_10',
};

export default function App() {
  const [screenState, setScreenState] = useState<AppScreenState>('playing');
  const [opticsState, setOpticsState] = useState<OpticsState>(INITIAL_OPTICS_STATE);

  const handleUpdateState = useCallback((patch: Partial<OpticsState>) => {
    setOpticsState((prev) => ({
      ...prev,
      ...patch,
    }));
  }, []);

  const handleReset = useCallback(() => {
    labAudio.playPowerSwitch(true);
    setOpticsState(INITIAL_OPTICS_STATE);
  }, []);

  const calc = useMemo(() => calculateOptics(opticsState), [opticsState]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (screenState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          labAudio.playPowerSwitch(true);
          setScreenState('playing');
        }
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        setScreenState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        return;
      }

      if (screenState !== 'playing') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setOpticsState((prev) => {
          const nextType = prev.lensType === 'converging' ? 'diverging' : 'converging';
          const nextProfile = nextType === 'converging' ? 'conv_10' : 'div_10';
          labAudio.playLensSwap(nextType === 'converging');
          return {
            ...prev,
            lensType: nextType,
            lensProfileId: nextProfile,
            focalLength: 10,
          };
        });
      } else if (e.code === 'Digit1') {
        setOpticsState((prev) => ({ ...prev, experimentMode: 'laser_rays', beamMode: 'single' }));
      } else if (e.code === 'Digit2') {
        setOpticsState((prev) => ({ ...prev, experimentMode: 'laser_rays', beamMode: 'double' }));
      } else if (e.code === 'Digit3') {
        setOpticsState((prev) => ({ ...prev, experimentMode: 'laser_rays', beamMode: 'triple' }));
      } else if (e.code === 'Digit4') {
        setOpticsState((prev) => ({ ...prev, experimentMode: 'laser_rays', beamMode: 'bundle' }));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screenState]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0b0f17] select-none">
      <OpticsScene3D
        state={opticsState}
        calc={calc}
        onUpdateState={handleUpdateState}
      />

      <ControlOverlay
        screenState={screenState}
        setScreenState={setScreenState}
        state={opticsState}
        calc={calc}
        onUpdateState={handleUpdateState}
        onReset={handleReset}
      />
    </main>
  );
}
