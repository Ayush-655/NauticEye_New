import { NOW, SPILLS, VESSELS } from './demo-data'
import type { MaritimeDataset } from './types'

export function getDemonstrationDataset(): MaritimeDataset {
  return { source: 'simulated', referenceTime: NOW, spills: SPILLS, vessels: VESSELS }
}
