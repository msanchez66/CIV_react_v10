import { Segment } from '../types/Segment';

// Calculate distance between two points using Haversine formula
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Calculate distance from point to line segment
export function distanceToSegment(
  pointLat: number, 
  pointLng: number, 
  segment: Segment
): number {
  if (!segment.geometry || !segment.geometry.coordinates || segment.geometry.coordinates.length < 2) {
    return Infinity;
  }

  const coords = segment.geometry.coordinates;
  let minDistance = Infinity;

  // Check distance to each line segment in the geometry
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    
    // Calculate distance from point to line segment
    const distance = pointToLineDistance(pointLat, pointLng, y1, x1, y2, x2);
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

// Calculate distance from point to line segment using perpendicular distance
function pointToLineDistance(
  px: number, py: number, 
  x1: number, y1: number, 
  x2: number, y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    // Line segment is actually a point
    return calculateDistance(px, py, x1, y1);
  }

  let param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  return calculateDistance(px, py, xx, yy);
}

// Find closest segment to a point
export function findClosestSegment(
  pointLat: number, 
  pointLng: number, 
  segments: Segment[]
): { segment: Segment | null, distance: number } {
  let closestSegment: Segment | null = null;
  let minDistance = Infinity;

  for (const segment of segments) {
    const distance = distanceToSegment(pointLat, pointLng, segment);
    if (distance < minDistance) {
      minDistance = distance;
      closestSegment = segment;
    }
  }

  return { segment: closestSegment, distance: minDistance };
}

// Format segment code for display
export function formatSegmentCode(segment: Segment | null): string {
  if (!segment) return 'N/A';
  
  const municipality = segment.properties?.municipality || 'UNK';
  const streetCode = segment.properties?.street_code || '000000';
  
  return `${municipality}-${streetCode}`;
}

// Format distance for display
export function formatDistance(distance: number): string {
  if (distance === Infinity) return 'N/A';
  
  if (distance < 1000) {
    return `${distance.toFixed(2)}m`;
  } else {
    return `${(distance / 1000).toFixed(2)}km`;
  }
}
