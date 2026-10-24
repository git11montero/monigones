import { useGame } from '../lib/api';
import { BUILDING_VISUALS, WORLD } from '../lib/visuals';
import { AtlasSprite } from './AtlasSprite';
/** Connected district plan. Decoration depends on real headquarters/stadium levels. */
export function CampusGround() {
  const { club } = useGame(),
    level = club.buildings.hq || 1,
    developed = level >= 3;
  const ring =
    'M300 145 Q115 185 140 430 L165 925 Q130 1120 170 1375 Q195 1750 470 1810 L1040 1830 Q1280 1800 1290 1520 L1270 1080 Q1315 825 1250 640 L1170 310 Q1100 140 895 140 Z';
  const boulevard = 'M150 955 Q445 1110 785 1040 Q1050 980 1280 1090';
  const paths = [
    'M290 355 Q425 390 535 380 Q805 365 1030 405',
    'M655 295 Q590 430 570 610 Q560 725 675 780 Q800 835 890 745 L1100 750',
    'M300 660 Q375 695 420 820 L300 980',
    'M1070 1050 Q910 1190 735 1260 Q590 1340 340 1260',
    'M170 1420 Q500 1410 675 1510 Q865 1630 1100 1630',
    'M1110 1360 Q1030 1450 1080 1645',
    'M700 1265 Q795 1425 700 1565',
  ];
  const forest = [
    { x: 30, y: 20, w: 200, h: 160, n: 15 },
    { x: 1120, y: 20, w: 270, h: 230, n: 18 },
    { x: 10, y: 480, w: 100, h: 390, n: 14 },
    { x: 1300, y: 900, w: 115, h: 900, n: 20 },
    { x: 20, y: 1750, w: 280, h: 160, n: 12 },
    { x: 800, y: 1850, w: 450, h: 65, n: 10 },
    { x: 400, y: 1130, w: 120, h: 100, n: 7 },
  ];
  const random = (n: number) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  return (
    <svg
      className="campus-ground"
      width={WORLD.width}
      height={WORLD.height}
      viewBox="0 0 1420 1920"
      aria-hidden="true"
      data-terrain-level={level}
    >
      <defs>
        <linearGradient id="v02-grass" x2=".8" y2="1">
          <stop stopColor="#668e4e" />
          <stop offset=".4" stopColor="#8ba960" />
          <stop offset="1" stopColor="#426f50" />
        </linearGradient>
        <pattern id="v02-lawn" width="90" height="63" patternUnits="userSpaceOnUse">
          <path
            d="M3 14l4-3m12 29l3-5m42 9l5-3m-8-30l2-4M34 22l4-3"
            stroke="#d3d694"
            opacity=".28"
          />
          <path d="M12 10l2 4m61 29l3-4m-31 15l4-2" stroke="#295f42" opacity=".24" />
          <ellipse cx="24" cy="27" rx="15" ry="8" fill="#c1c68c" opacity=".08" />
        </pattern>
        <pattern
          id="v02-stone"
          width="38"
          height="24"
          patternUnits="userSpaceOnUse"
          patternTransform="skewX(-28)"
        >
          <rect width="38" height="24" fill="#c7bda3" />
          <path d="M0 1H38M19 1V24" stroke="#a99e86" strokeWidth="1.5" />
          <path d="M1 3H18" stroke="#e5d9bd" opacity=".5" />
        </pattern>
        <pattern id="v02-brick" width="25" height="18" patternUnits="userSpaceOnUse">
          <rect width="25" height="18" fill="#bb9879" />
          <path d="M0 0H25M0 9H25M12 0V9M0 9V18" stroke="#d6c2a0" strokeWidth="1.5" />
        </pattern>
        <pattern id="v02-pitch" width="70" height="220" patternUnits="userSpaceOnUse">
          <rect width="70" height="220" fill="#47844d" />
          <rect width="35" height="220" fill="#539554" />
        </pattern>
        <filter id="v02-ground-shadow" x="-30%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="6" dy="10" stdDeviation="5" floodColor="#23452e" floodOpacity=".4" />
        </filter>
      </defs>
      <rect width="1420" height="1920" fill="url(#v02-grass)" />
      <path
        d="M0 850Q260 780 390 1120T1000 1430Q1260 1520 1420 1380V1920H0Z"
        fill="#497c4c"
        opacity=".18"
      />
      <path d="M0 80Q310 0 380 170T860 230Q1180 290 1420 160V0H0Z" fill="#c0b977" opacity=".15" />
      <rect width="1420" height="1920" fill="url(#v02-lawn)" />
      <path
        d="M1410 -20Q1260 350 1380 760T1400 1430L1460 1500V-20Z"
        fill="#b4b18a"
        stroke="#7f9565"
        strokeWidth="26"
      />
      <path
        d="M1420 -20Q1280 350 1400 760T1420 1430"
        fill="none"
        stroke="#4a9d9c"
        strokeWidth="45"
      />
      <path
        d={ring}
        fill="none"
        stroke="#354f3e"
        strokeWidth="84"
        opacity=".25"
        transform="translate(2 8)"
      />
      {[ring, boulevard].map((d) => (
        <g key={d}>
          <path d={d} fill="none" stroke="#e0d1af" strokeWidth={developed ? 83 : 72} />
          <path d={d} fill="none" stroke="#8d8f80" strokeWidth={developed ? 65 : 54} />
          <path
            d={d}
            fill="none"
            stroke={developed ? '#626f6a' : '#9a997e'}
            strokeWidth={developed ? 58 : 48}
          />
          <path d={d} fill="none" stroke="#ddd4b2" strokeDasharray="19 22" strokeWidth="2.5" />
        </g>
      ))}
      {paths.map((d, i) => (
        <g key={d}>
          <path
            d={d}
            fill="none"
            stroke="#3b6541"
            strokeWidth="40"
            opacity=".3"
            transform="translate(3 6)"
          />
          <path d={d} fill="none" stroke="#dfd2ad" strokeWidth={i === 0 ? 44 : 30} />
          <path
            d={d}
            fill="none"
            stroke={developed ? 'url(#v02-stone)' : i % 3 === 0 ? 'url(#v02-brick)' : '#cbbd96'}
            strokeWidth={i === 0 ? 36 : 24}
          />
        </g>
      ))}
      {/* Distinct forecourts anchor every sprite to a plot and a pedestrian approach. */}
      {Object.entries(BUILDING_VISUALS).map(([id, v]) => (
        <g key={id} filter="url(#v02-ground-shadow)">
          <path
            d={`M${v.x - v.width * 0.58} ${v.y - 42} l${v.width * 0.77} -50 ${v.width * 0.47} 78 -${v.width * 0.78} 53 Z`}
            fill={
              id === 'research'
                ? '#aac7c2'
                : id === 'academy' || id === 'training'
                  ? '#8ba65d'
                  : id === 'finance'
                    ? '#a5aaa0'
                    : 'url(#v02-stone)'
            }
            stroke="#ded6b4"
            strokeWidth="5"
          />
          <path
            d={`M${v.x - v.width * 0.55} ${v.y - 35}l${v.width * 0.74} -47`}
            fill="none"
            stroke="#ffffff"
            opacity=".35"
            strokeWidth="2"
          />
        </g>
      ))}
      {/* Stadium fan square, parking and zebra crossings. */}
      <path
        d="M450 620L690 570 890 685 650 795 425 680Z"
        fill="url(#v02-stone)"
        stroke="#ece1c0"
        strokeWidth="7"
      />
      <path d="M715 780L830 730 975 805 860 855Z" fill="#68756e" stroke="#d4c9ad" strokeWidth="7" />
      {Array.from({ length: 8 }, (_, i) => (
        <path
          key={i}
          d={`M${730 + i * 17} ${782 - i * 6}l60 33`}
          stroke="#e0d6b3"
          strokeWidth="2"
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <path
          key={i}
          d={`M${100 + i * 9} 941l-3 25M${1245 + i * 8} 1072l-3 27`}
          stroke="#e5dfc2"
          strokeWidth="5"
        />
      ))}
      {/* Academy practice fields, retaining wall, surrounding fence. */}
      <g transform="translate(900 815) skewY(-12)">
        <rect
          width="260"
          height="142"
          rx="4"
          fill="url(#v02-pitch)"
          stroke="#d7cf9e"
          strokeWidth="9"
        />
        <rect x="10" y="10" width="240" height="122" fill="none" stroke="#d6e4b3" strokeWidth="2" />
        <path
          d="M130 10V132M10 40H46V102H10M250 40H214V102H250"
          fill="none"
          stroke="#d6e4b3"
          strokeWidth="2"
        />
        <circle cx="130" cy="71" r="25" fill="none" stroke="#d6e4b3" strokeWidth="2" />
        {[0, 52, 104, 156, 208, 260].map((x) => (
          <path key={x} d={`M${x} 0v-20m0 162v-20`} stroke="#687765" strokeWidth="3" />
        ))}
        <path d="M0-14H260M0 146H260" stroke="#85927a" strokeWidth="2" />
      </g>
      <g transform="translate(960 455)">
        <path d="M-70 0L65-25 126 16-10 44Z" fill="#849e99" stroke="#c0d4cc" strokeWidth="4" />
        <path d="M-50 3l90-18m-65 38l90-18" stroke="#a1e5dc" strokeWidth={level >= 4 ? 4 : 2} />
      </g>
      <ellipse
        cx="1080"
        cy="1730"
        rx="105"
        ry="45"
        fill="url(#v02-brick)"
        stroke="#e0cfaa"
        strokeWidth="8"
      />
      <AtlasSprite
        atlas="props"
        row={1}
        column={2}
        x={1018}
        y={1615}
        width={125}
        height={130}
        className="fountain-water"
      />
      {/* Deliberately irregular copses, not rows or a grid. */}
      {forest.flatMap((area, ai) =>
        Array.from({ length: area.n }, (_, i) => {
          const seed = ai * 97 + i,
            x = area.x + random(seed) * area.w,
            y = area.y + random(seed + 33) * area.h,
            scale = 0.6 + random(seed + 87) * 0.55;
          return (
            <AtlasSprite
              key={`${ai}:${i}`}
              atlas="props"
              row={0}
              column={i % 3}
              x={x}
              y={y}
              width={68 * scale}
              height={96 * scale}
            />
          );
        }),
      )}
      {/* Shrub beds, benches, lamps and wayfinding are concentrated near entrances. */}
      {Object.entries(BUILDING_VISUALS).map(([id, v], i) => (
        <g key={id}>
          <ellipse cx={v.x - v.width * 0.42} cy={v.y + 21} rx="31" ry="13" fill="#395d3b" />
          <ellipse cx={v.x - v.width * 0.42} cy={v.y + 15} rx="29" ry="12" fill="#68934d" />
          <AtlasSprite
            atlas="props"
            row={2}
            column={0}
            x={v.x + v.width * 0.43}
            y={v.y - 32}
            width={30}
            height={58}
          />
          {level >= 2 && (
            <g transform={`translate(${v.x - v.width * 0.4} ${v.y + 33})`}>
              <path d="M0 0l30-8 9 6-30 8Z" fill="#b28354" stroke="#765d42" strokeWidth="2" />
              <path d="M6 5v9m25-15v9" stroke="#455348" strokeWidth="3" />
            </g>
          )}
          {i % 3 === 0 && (
            <g transform={`translate(${v.x + v.width * 0.36} ${v.y + 29})`}>
              <path d="M0 0v-25" stroke="#627568" strokeWidth="3" />
              <path
                d="M-18-31H18L24-25 18-19H-18Z"
                fill="#254f51"
                stroke="#c9bd91"
                strokeWidth="2"
              />
            </g>
          )}
          {level >= 4 && (
            <ellipse
              cx={v.x + v.width * 0.47}
              cy={v.y + 19}
              rx="37"
              ry="19"
              fill="#ffe7a0"
              opacity=".17"
            />
          )}
        </g>
      ))}
      {level >= 3 && (
        <path
          d="M370 1460q20-14 40 0t40 0t40 0M430 1510q20-14 40 0t40 0"
          fill="none"
          stroke="#c4ab70"
          strokeWidth="10"
        />
      )}
      <text
        x="720"
        y="1900"
        textAnchor="middle"
        fill="#d4d5ad"
        fontSize="28"
        fontWeight="900"
        letterSpacing="9"
      >
        CIUDAD DEPORTIVA · MONIGONES
      </text>
    </svg>
  );
}
