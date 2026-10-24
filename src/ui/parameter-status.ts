import type { Range } from '../data/types.ts';
import { RULES } from '../logic/brewing.ts';

export function parameterStatus(
  value: number,
  zone?: Range,
  tolerance = RULES.tolerance,
): string {
  if (!zone) return 'Awaiting recipe';
  if (value >= zone.min && value <= zone.max) return '✓ In target range';
  if (value >= zone.min - tolerance && value <= zone.max + tolerance)
    return `≈ Within ±${String(tolerance)} tolerance`;
  return value < zone.min ? '↑ Below target' : '↓ Above target';
}
