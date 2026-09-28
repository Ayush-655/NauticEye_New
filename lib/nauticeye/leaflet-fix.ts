/**
 * leaflet-fix.ts
 *
 * Leaflet's default marker icons reference image files using a relative
 * path that breaks in Next.js (it points to file:/// instead of http://).
 *
 * This file overrides the default icon URLs to remove that broken reference.
 * Import this file ONCE at the top of intelligence-map.tsx.
 */

import L from 'leaflet'

// Tell Leaflet not to try to auto-detect icon URLs from its CSS.
// We use custom divIcon markers throughout the app anyway, so
// the default PNG markers are never actually shown — but Leaflet
// still tries to load them and throws a Security Error.
delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl:  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})
