export interface Segment {
  id: string;
  name?: string;
  street_name?: string;
  street_code?: string;
  fclass?: string;
  coords: [number, number][];
  length?: number;
  municipality?: string;
  [key: string]: any;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SegmentStyle {
  color: string;
  weight: number;
  opacity: number;
}
