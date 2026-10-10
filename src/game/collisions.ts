export type Point = { x: number; y: number }

// Retorna o primeiro contato no trajeto, para o tiro não atravessar um alvo entre frames.
export function circleContact(start: Point, end: Point, center: Point, radius: number): number | undefined {
  const x = start.x - center.x
  const y = start.y - center.y
  const dx = end.x - start.x
  const dy = end.y - start.y
  const c = x * x + y * y - radius * radius
  if (c <= 0) return 0
  const a = dx * dx + dy * dy
  if (a === 0) return undefined
  const b = 2 * (x * dx + y * dy)
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return undefined
  const contact = (-b - Math.sqrt(discriminant)) / (2 * a)
  return contact >= 0 && contact <= 1 ? contact : undefined
}

export function clampToArena(point: Point, radius: number, width: number, height: number): Point {
  return { x: Math.max(radius, Math.min(width - radius, point.x)), y: Math.max(radius, Math.min(height - radius, point.y)) }
}
