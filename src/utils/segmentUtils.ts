import { Segment } from '../types/Segment';

export const getSegmentStyle = (segment: Segment) => {
  let color = '#8B4513'; // Default maroon
  let weight = 4; // Thicker lines

  if (segment.fclass) {
    const fclass = segment.fclass.toLowerCase();
    if (fclass.includes('motorway')) { color = '#228B22'; weight = 6; } // Green
    else if (fclass.includes('trunk')) { color = '#8B4513'; weight = 6; } // Maroon
    else if (fclass.includes('primary')) { color = '#228B22'; weight = 5; } // Green
    else if (fclass.includes('secondary')) { color = '#8B4513'; weight = 5; } // Maroon
    else if (fclass.includes('tertiary')) { color = '#228B22'; weight = 4; } // Green
    else if (fclass.includes('residential')) { color = '#8B4513'; weight = 3; } // Maroon
    else if (fclass.includes('service')) { color = '#228B22'; weight = 3; } // Green
  }

  return { color, weight, opacity: 1.0 };
};

export const filterSegmentsInBounds = (segments: Segment[], bounds: any): Segment[] => {
  return segments.filter(segment => {
    if (!segment.coords || segment.coords.length < 2) return false;
    
    return segment.coords.some(coord => {
      const [lon, lat] = coord;
      return bounds.contains([lat, lon]);
    });
  });
};

export const searchSegments = (segments: Segment[], query: string): Segment[] => {
  if (!query.trim()) return [];
  
  const lowercaseQuery = query.toLowerCase();
  
  return segments.filter(segment => {
    const name = segment.street_name || segment.name || '';
    const code = segment.street_code || '';
    return name.toLowerCase().includes(lowercaseQuery) || 
           code.toLowerCase().includes(lowercaseQuery);
  });
};

export const calculateStatistics = (segments: Segment[]) => {
  const segmentsWithLength = segments.filter(s => s.length && s.length > 10);
  
  if (segmentsWithLength.length === 0) {
    return { maxLength: 0, minLength: 0 };
  }
  
  const lengths = segmentsWithLength.map(s => s.length!);
  return {
    maxLength: Math.max(...lengths),
    minLength: Math.min(...lengths)
  };
};
