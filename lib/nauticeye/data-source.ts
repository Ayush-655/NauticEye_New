/**
 * data-source.ts  (updated)
 *
 * getDemonstrationDataset() — unchanged, used by the server-side /lite route
 *   and as a fallback when live AIS is unavailable.
 *
 * getLiveDataset() — builds a MaritimeDataset with live vessels injected.
 *   The spills are always from the demo set (we don't yet have a real
 *   spill detection pipeline), but the vessels are real.
 */

import { NOW, SPILLS, VESSELS } from './demo-data'
import type { MaritimeDataset, Vessel } from './types'

/** Always-available demo dataset (used by /lite and as fallback). */
export function getDemonstrationDataset(): MaritimeDataset {
  return {
    source:        'simulated',
    referenceTime: NOW,
    spills:        SPILLS,
    vessels:       VESSELS,
  }
}

/**
 * Build a dataset that uses real AIS vessels.
 * Call this from the client after useLiveVessels() resolves.
 *
 * @param liveVessels  Vessels returned by the /api/vessels route
 * @param referenceTime  The "now" timestamp to use (default: actual now)
 */
export function getLiveDataset(
  liveVessels: Vessel[],
  referenceTime: number = Date.now(),
): MaritimeDataset {
  return {
    source:        'live',
    referenceTime,
    spills:        SPILLS,           // still demo spills
    vessels:       liveVessels,
  }
}
