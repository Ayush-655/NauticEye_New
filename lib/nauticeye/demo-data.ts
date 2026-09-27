import type { Spill, Vessel } from './types'

export const NOW = Date.UTC(2026, 8, 9, 9, 0, 0); // 2026-09-09T09:00:00Z
const T = (hAgo: number) => NOW - hAgo * 3600000;

export const SPILLS: Spill[] = [
  {
    id:'S1', name:'Mumbai High Slick', lat:19.52, lng:71.48,
    detectedAt:T(2), confidence:94, area:12.4, severity:'high', status:'active',
    satellite:'RISAT-2BR1 (simulated)',
    desc:"Elongated slick immediately south-west of the Mumbai High offshore platform cluster. SAR backscatter and low-texture edges are consistent with a fresh crude discharge rather than a weathered natural film."
  },
  {
    id:'S2', name:'Shipping Lane B Slick', lat:18.75, lng:70.20,
    detectedAt:T(5), confidence:78, area:6.1, severity:'medium', status:'active',
    satellite:'Sentinel-1 (simulated)',
    desc:"Narrow, linear slick aligned with a tanker corridor into Mumbai Port — the shape suggests a discharge from a moving vessel rather than a static source."
  },
  {
    id:'S3', name:'Khambhat Estuary Sheen', lat:20.85, lng:72.05,
    detectedAt:T(9), confidence:61, area:2.3, severity:'low', status:'review',
    satellite:'RISAT-2BR1 (simulated)',
    desc:"Faint, patchy sheen near the Gulf of Khambhat mouth. Texture is also consistent with a natural biogenic seep or a tidal convergence line — flagged for analyst review rather than an automatic alert."
  },
  {
    id:'S4', name:'Ratnagiri Coastal Slick', lat:17.05, lng:72.75,
    detectedAt:T(48), confidence:88, area:8.7, severity:'high', status:'resolved',
    satellite:'Sentinel-1 (simulated)',
    desc:"Historic case, closed. Reconstructed AIS track matched MT Liberia Trader's course through the slick footprint to within 1.4 km at the time of detection.",
    resolvedNote:"Vessel detained at Mumbai anchorage under Port State Control on 8 Sep 2026. Case closed; penalty proceedings underway."
  },
];

// vessel track point: {t: ms, lat, lng, course(deg), speed(kn)}
export const VESSELS: Vessel[] = [
  { id:'V1', name:'MT Konkan Pride', mmsi:'419234561', flag:'India', type:'Crude Oil Tanker',
    track:[
      {t:T(30), lat:18.93, lng:72.88, course:300, speed:12},
      {t:T(18), lat:19.05, lng:72.40, course:290, speed:12},
      {t:T(9),  lat:19.28, lng:71.85, course:285, speed:11},
      {t:T(2),  lat:19.50, lng:71.50, course:270, speed:10},
      {t:T(0),  lat:19.62, lng:71.30, course:265, speed:13},
    ]},
  { id:'V2', name:'MT Arabian Voyager', mmsi:'352981004', flag:'Panama', type:'Crude Oil Tanker',
    track:[
      {t:T(30), lat:17.85, lng:68.85, course:35, speed:14},
      {t:T(20), lat:18.20, lng:69.35, course:36, speed:14},
      {t:T(13), lat:18.55, lng:69.85, course:38, speed:14},
      {t:T(5),  lat:18.75, lng:70.20, course:40, speed:15},
      {t:T(0),  lat:19.05, lng:70.75, course:42, speed:15},
    ]},
  { id:'V3', name:'MT Liberia Trader', mmsi:'636019283', flag:'Liberia', type:'Product Tanker', flagged:true,
    track:[
      {t:T(54), lat:16.80, lng:73.10, course:320, speed:13},
      {t:T(50), lat:16.95, lng:72.90, course:315, speed:13},
      {t:T(48), lat:17.05, lng:72.75, course:310, speed:13},
      {t:T(30), lat:17.60, lng:72.20, course:300, speed:14},
      {t:T(0),  lat:18.92, lng:72.83, course:280, speed:0},
    ]},
  { id:'V4', name:'MV Saurashtra Star', mmsi:'419556789', flag:'India', type:'Chemical Tanker',
    track:[
      {t:T(24), lat:22.00, lng:68.95, course:200, speed:12},
      {t:T(16), lat:21.20, lng:69.45, course:150, speed:12},
      {t:T(8),  lat:20.65, lng:70.30, course:110, speed:11},
      {t:T(2),  lat:20.55, lng:71.70, course:85,  speed:10},
      {t:T(0),  lat:20.75, lng:72.15, course:55,  speed:9},
    ]},
  { id:'V5', name:'MT Kutch Explorer', mmsi:'419887001', flag:'India', type:'Crude Oil Tanker',
    track:[
      {t:T(30), lat:22.78, lng:69.62, course:0, speed:0},
      {t:T(20), lat:22.79, lng:69.63, course:10, speed:0},
      {t:T(10), lat:22.77, lng:69.61, course:0, speed:0},
      {t:T(0),  lat:22.78, lng:69.62, course:0, speed:0},
    ]},
  { id:'V6', name:'MV Gulf Carrier', mmsi:'538002345', flag:'Marshall Islands', type:'Bulk Carrier',
    track:[
      {t:T(28), lat:17.40, lng:66.90, course:60, speed:13},
      {t:T(18), lat:17.55, lng:67.35, course:60, speed:13},
      {t:T(8),  lat:17.70, lng:67.85, course:58, speed:13},
      {t:T(0),  lat:17.85, lng:68.25, course:55, speed:13},
    ]},
  { id:'V7', name:'FV Sagar Kanya', mmsi:'419011223', flag:'India', type:'Fishing Trawler',
    track:[
      {t:T(12), lat:18.85, lng:72.70, course:200, speed:6},
      {t:T(8),  lat:18.70, lng:72.65, course:210, speed:6},
      {t:T(4),  lat:18.55, lng:72.60, course:215, speed:6},
      {t:T(0),  lat:18.45, lng:72.58, course:220, speed:5},
    ]},
  { id:'V8', name:'MV Konkan Runner', mmsi:'419334455', flag:'India', type:'Container Ship',
    track:[
      {t:T(20), lat:18.90, lng:72.75, course:170, speed:16},
      {t:T(14), lat:18.30, lng:72.78, course:175, speed:16},
      {t:T(7),  lat:17.70, lng:72.85, course:178, speed:15},
      {t:T(0),  lat:17.10, lng:72.90, course:180, speed:15},
    ]},
  { id:'V9', name:'MT Singapore Glory', mmsi:'563021198', flag:'Singapore', type:'Product Tanker',
    track:[
      {t:T(26), lat:16.50, lng:70.50, course:320, speed:14},
      {t:T(16), lat:17.10, lng:70.00, course:315, speed:14},
      {t:T(6),  lat:17.70, lng:69.50, course:310, speed:14},
      {t:T(0),  lat:18.10, lng:69.10, course:305, speed:14},
    ]},
  { id:'V10', name:'MV Kathiawar Express', mmsi:'419667788', flag:'India', type:'General Cargo',
    track:[
      {t:T(15), lat:21.60, lng:72.60, course:230, speed:12},
      {t:T(10), lat:21.20, lng:72.40, course:225, speed:12},
      {t:T(5),  lat:20.80, lng:72.30, course:220, speed:11},
      {t:T(0),  lat:20.40, lng:72.10, course:215, speed:11},
    ]},
  { id:'V11', name:'MT Persian Horizon', mmsi:'422004455', flag:'Iran', type:'Crude Oil Tanker',
    track:[
      {t:T(30), lat:21.50, lng:66.00, course:140, speed:13},
      {t:T(20), lat:20.60, lng:67.00, course:135, speed:13},
      {t:T(10), lat:19.70, lng:68.00, course:130, speed:13},
      {t:T(0),  lat:18.80, lng:69.00, course:125, speed:13},
    ]},
  { id:'V12', name:'MV Okha Pioneer', mmsi:'419778899', flag:'India', type:'Offshore Supply Vessel',
    track:[
      {t:T(16), lat:19.60, lng:71.55, course:200, speed:9},
      {t:T(11), lat:19.55, lng:71.50, course:210, speed:8},
      {t:T(6),  lat:19.48, lng:71.60, course:220, speed:9},
      {t:T(0),  lat:19.35, lng:71.80, course:230, speed:9},
    ]},
  { id:'V13', name:'MT Daman Spirit', mmsi:'419992200', flag:'India', type:'Chemical Tanker',
    track:[
      {t:T(22), lat:19.80, lng:72.60, course:250, speed:12},
      {t:T(14), lat:19.40, lng:72.00, course:255, speed:12},
      {t:T(7),  lat:19.00, lng:71.40, course:260, speed:12},
      {t:T(0),  lat:18.60, lng:70.80, course:265, speed:12},
    ]},
  { id:'V14', name:'MV Bombay Merchant', mmsi:'419445566', flag:'India', type:'General Cargo',
    track:[
      {t:T(10), lat:18.94, lng:72.84, course:0, speed:0},
      {t:T(6),  lat:18.94, lng:72.84, course:0, speed:0},
      {t:T(2),  lat:18.95, lng:72.85, course:0, speed:0},
      {t:T(0),  lat:18.95, lng:72.85, course:90, speed:3},
    ]},
];

export const PLACE_LABELS = [
  {name:'Mumbai', lat:18.96, lng:72.86},
  {name:'Mumbai High Field', lat:19.52, lng:71.35},
  {name:'Kandla', lat:23.03, lng:70.22},
  {name:'Ratnagiri', lat:16.99, lng:73.30},
  {name:'Gulf of Khambhat', lat:21.30, lng:72.35},
];
