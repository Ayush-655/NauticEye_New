import type { Vessel, Spill, Approach } from './types'
import { VESSELS, NOW } from './demo-data'

const REF_LAT = 19.5;
export function toXY(lat: number, lng: number){ return { x: lng*111.32*Math.cos(REF_LAT*Math.PI/180), y: lat*111.32 }; }
export function haversineKm(lat1: number,lng1: number,lat2: number,lng2: number){
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
export function bearingDeg(lat1: number,lng1: number,lat2: number,lng2: number){
  const r=Math.PI/180, φ1=lat1*r, φ2=lat2*r, Δλ=(lng2-lng1)*r;
  const y=Math.sin(Δλ)*Math.cos(φ2);
  const x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
  return (Math.atan2(y,x)*180/Math.PI + 360) % 360;
}
export function angleDiff(a: number,b: number){ let d=Math.abs(a-b)%360; if(d>180) d=360-d; return d; }
export function clamp(v: number,a: number,b: number){ return Math.max(a, Math.min(b, v)); }

export function closestApproach(vessel: Vessel, spill: Spill): Approach {
  let best: Approach | null = null;
  for(let i=0;i<vessel.track.length-1;i++){
    const A=vessel.track[i], B=vessel.track[i+1];
    const pa=toXY(A.lat,A.lng), pb=toXY(B.lat,B.lng), ps=toXY(spill.lat,spill.lng);
    const dx=pb.x-pa.x, dy=pb.y-pa.y;
    const lenSq = dx*dx+dy*dy;
    let t = lenSq===0 ? 0 : ((ps.x-pa.x)*dx+(ps.y-pa.y)*dy)/lenSq;
    t = clamp(t,0,1);
    const cx=pa.x+t*dx, cy=pa.y+t*dy;
    const distKm = Math.hypot(ps.x-cx, ps.y-cy);
    if(!best || distKm < best.distKm){
      best = {
        distKm, t,
        atTime: A.t + t*(B.t-A.t),
        lat: A.lat + t*(B.lat-A.lat),
        lng: A.lng + t*(B.lng-A.lng),
        course: A.course + t*(B.course-A.course),
      };
    }
  }
  if (!best) throw new Error('At least two AIS points are required.');
  return best;
}

export function scoreVesselForSpill(vessel: Vessel, spill: Spill){
  const ca = closestApproach(vessel, spill);
  const timeDiffH = Math.abs(spill.detectedAt - ca.atTime) / 3600000;
  const proximity = clamp(100 - ca.distKm * (100/45), 0, 100);
  const timeScore = clamp(100 - timeDiffH * (100/20), 0, 100);
  const bearingToSpill = bearingDeg(ca.lat, ca.lng, spill.lat, spill.lng);
  const headingDiff = angleDiff(ca.course, bearingToSpill);
  const courseScore = clamp(100 - headingDiff * (100/100), 0, 100);
  // Proximity gates the whole score — a vessel that was never actually near
  // the spill cannot be a real candidate, no matter how well its timing or
  // heading line up. Without this gate, a vessel hundreds of km away could
  // still score 40-50% purely from a lucky time/course match.
  const weighted = proximity*0.45 + timeScore*0.35 + courseScore*0.20;
  const overall = Math.round(weighted * (proximity/100));
  return { overall, proximity: Math.round(proximity), timeScore: Math.round(timeScore),
    courseScore: Math.round(courseScore), distKm: ca.distKm, timeDiffH };
}

export function rankVessels(spill: Spill, vessels: Vessel[] = VESSELS){
  return vessels.filter(v => v.track.length >= 2).map(v => ({ vessel:v, score: scoreVesselForSpill(v, spill) }))
    .sort((a,b) => b.score.overall - a.score.overall);
}

export function interpAt(vessel: Vessel, hoursAgo: number, referenceTime: number = NOW){
  const simMs = referenceTime - hoursAgo*3600000;
  const tr = vessel.track;
  if (!tr.length) throw new Error('At least one AIS point is required for replay.');
  if(simMs <= tr[0].t) return { ...tr[0] };
  if(simMs >= tr[tr.length-1].t) return { ...tr[tr.length-1] };
  for(let i=0;i<tr.length-1;i++){
    const A=tr[i], B=tr[i+1];
    if(simMs>=A.t && simMs<=B.t){
      const f = (simMs-A.t)/(B.t-A.t);
      return {
        lat: A.lat+f*(B.lat-A.lat), lng: A.lng+f*(B.lng-A.lng),
        course: (A.course + f * ((B.course - A.course + 540) % 360 - 180) + 360) % 360, speed: A.speed+f*(B.speed-A.speed),
      };
    }
  }
  return { ...tr[tr.length-1] };
}

export function hashStr(s: string){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31 + s.charCodeAt(i))|0; } return Math.abs(h)||1; }
export function prand(x: number){ const s=Math.sin(x)*43758.5453123; return s - Math.floor(s); }
export function blobPoints(lat: number,lng: number,radiusKm: number,seed: number,n=12){
  const pts: [number, number][]=[];
  for(let i=0;i<n;i++){
    const ang=(i/n)*Math.PI*2;
    const r = radiusKm*(0.55+0.5*prand(seed+i*7.13));
    const dLat = (r/111.32)*Math.sin(ang);
    const dLng = (r/(111.32*Math.cos(lat*Math.PI/180)))*Math.cos(ang)*1.3;
    pts.push([lat+dLat, lng+dLng]);
  }
  return pts;
}
