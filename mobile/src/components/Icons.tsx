import React from 'react';
import { Path, Svg, Circle, Rect, G, Line } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  stroke?: number;
}

const wrap = (children: React.ReactNode) => ({ size = 22, color = 'currentColor', stroke = 1.6 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const Icons = {
  home:    wrap(<><Path d="M3 11 L12 4 L21 11" /><Path d="M5 10v10h14V10" /><Path d="M10 20v-5h4v5" /></>),
  truck:   wrap(<><Path d="M2 7h12v9H2z" /><Path d="M14 10h4l3 3v3h-7" /><Circle cx="6.5" cy="18" r="1.8" /><Circle cx="17.5" cy="18" r="1.8" /></>),
  doc:     wrap(<><Path d="M7 3h8l4 4v14H7z" /><Path d="M14 3v5h5" /><Path d="M10 13h7M10 17h7M10 9h2" /></>),
  chat:    wrap(<><Path d="M4 5h16v11H9l-4 4z" /></>),
  bell:    wrap(<><Path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3z" /><Path d="M10 19a2 2 0 0 0 4 0" /></>),
  plus:    wrap(<><Path d="M12 5v14M5 12h14" /></>),
  arrow:   wrap(<><Path d="M5 12h14M13 5l7 7-7 7" /></>),
  arrowL:  wrap(<><Path d="M19 12H5M11 5l-7 7 7 7" /></>),
  chev:    wrap(<><Path d="M9 6l6 6-6 6" /></>),
  car:     wrap(<><Path d="M4 14l2-5a2 2 0 0 1 2-1.5h8a2 2 0 0 1 2 1.5l2 5v4h-3v-2H7v2H4z" /><Circle cx="7.5" cy="14.5" r="1.4" /><Circle cx="16.5" cy="14.5" r="1.4" /></>),
  bike:    wrap(<><Circle cx="5.5" cy="16.5" r="3" /><Circle cx="18.5" cy="16.5" r="3" /><Path d="M5.5 16.5 L11 8 L14 8 L18.5 16.5 M11 8 L9 5 H7" /></>),
  box:     wrap(<><Path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><Path d="M3 7l9 4 9-4M12 11v10" /></>),
  pallet:  wrap(<><Rect x="4" y="5" width="16" height="9" rx="1" /><Path d="M4 14v4M20 14v4M9 5v9M15 5v9" /></>),
  pin:     wrap(<><Path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" /><Circle cx="12" cy="9" r="2.5" /></>),
  camera:  wrap(<><Path d="M4 8h3l2-2h6l2 2h3v11H4z" /><Circle cx="12" cy="13.5" r="3.5" /></>),
  edit:    wrap(<><Path d="M4 20h4L20 8l-4-4L4 16z" /><Path d="M14 6l4 4" /></>),
  check:   wrap(<><Path d="M4 12l5 5L20 6" /></>),
  x:       wrap(<><Path d="M6 6l12 12M18 6L6 18" /></>),
  sig:     wrap(<><Path d="M3 18c4-2 6-12 9-12s3 8 5 8 2-2 4-2" /><Path d="M3 21h18" /></>),
  shield:  wrap(<><Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><Path d="M9 12l2 2 4-4" /></>),
  search:  wrap(<><Circle cx="11" cy="11" r="6" /><Path d="M16 16l4 4" /></>),
  globe:   wrap(<><Circle cx="12" cy="12" r="9" /><Path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>),
  star:    wrap(<><Path d="M12 4l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 17.4 6.8 20.1l1-5.8L3.5 10.2l5.9-.8z" /></>),
  euro:    wrap(<><Path d="M18 7a6 6 0 1 0 0 10" /><Path d="M4 10h10M4 14h10" /></>),
  fuel:    wrap(<><Path d="M5 21V5a2 2 0 0 1 2-2h7v18" /><Path d="M5 13h9" /><Path d="M14 8l3 2v9a2 2 0 0 0 2 2" /></>),
  user:    wrap(<><Circle cx="12" cy="8" r="4" /><Path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" /></>),
  phone:   wrap(<><Path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2 16 16 0 0 1-15-15 2 2 0 0 1 2-2z" /></>),
  calendar: wrap(<><Rect x="3" y="5" width="18" height="16" rx="2" /><Path d="M3 10h18M8 3v4M16 3v4" /></>),
  card:    wrap(<><Rect x="3" y="6" width="18" height="13" rx="2" /><Path d="M3 10h18M7 15h4" /></>),
  news:    wrap(<><Rect x="3" y="5" width="14" height="14" rx="1.5" /><Path d="M17 9h3v8a2 2 0 0 1-2 2" /><Path d="M6 9h8M6 13h8M6 17h5" /></>),
  warn:    wrap(<><Path d="M12 4l9 16H3z" /><Path d="M12 10v5M12 17.5v.5" /></>),
  bolt:    wrap(<><Path d="M13 3 L4 14 H11 L10 21 L20 10 H13 Z" /></>),
  flag:    wrap(<><Path d="M5 21V4M5 4l8 1 6-1v9l-6 1-8-1" /></>),
  more:    wrap(<><Circle cx="6" cy="12" r="1.5" /><Circle cx="12" cy="12" r="1.5" /><Circle cx="18" cy="12" r="1.5" /></>),
  sliders: wrap(<><Path d="M4 6h16M4 12h16M4 18h16" /><Circle cx="8" cy="6" r="2" /><Circle cx="16" cy="12" r="2" /><Circle cx="10" cy="18" r="2" /></>),
};

export type IconName = keyof typeof Icons;
