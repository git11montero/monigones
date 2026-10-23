import atlasBounds from '../lib/atlas-bounds.json';
export function AtlasSprite({
  atlas,
  row,
  column,
  x = 0,
  y = 0,
  width = 100,
  height = 100,
  className = '',
  label,
}: {
  atlas: keyof typeof atlasBounds;
  row: number;
  column: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  className?: string;
  label?: string;
}) {
  const b = atlasBounds[atlas][row][column],
    sourceSize = atlas === 'props' ? 1254 : 1536,
    sourceHeight = atlas === 'props' ? 1254 : 1024;
  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox="0 0 400 380"
      className={`atlas-sprite ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg
        x={(400 - b.width) / 2}
        y={375 - b.height}
        width={b.width}
        height={b.height}
        viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`}
        overflow="hidden"
      >
        <image href={`/art/${atlas}-atlas.webp`} width={sourceSize} height={sourceHeight} />
      </svg>
    </svg>
  );
}
