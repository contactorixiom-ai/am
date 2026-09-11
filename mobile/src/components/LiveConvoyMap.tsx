// Fallback (rendu SSR / Node) : carte stylisée sans tuiles réelles.
// Les vraies plateformes sont LiveConvoyMap.web.tsx et LiveConvoyMap.native.tsx.
import React from 'react';
import { View } from 'react-native';
import { StyledRouteMap } from './StyledRouteMap';

interface LatLng { latitude: number; longitude: number }
interface Props {
  from: LatLng;
  to: LatLng;
  progress: number;
  paused?: boolean;
  height?: number;
  fromLabel?: string;
  toLabel?: string;
}

export function LiveConvoyMap({ progress, height = 260, fromLabel, toLabel }: Props) {
  return (
    <View>
      <StyledRouteMap height={height} progress={progress} from={fromLabel} to={toLabel} />
    </View>
  );
}
