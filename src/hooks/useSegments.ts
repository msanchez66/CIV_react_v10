import { useState, useEffect, useCallback } from 'react';
import { Segment } from '../types/Segment';

export const useSegments = () => {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadSegments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load from full shapefile data (Vias_SantoDomingo_Split.shp)
      try {
        console.log('Attempting to load shapefile data...');
        const response = await fetch('/enhanced_segments_with_street_code.json');
        console.log('Response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('Shapefile data loaded:', data.length, 'segments');
          console.log('First segment sample:', data[0]);
          console.log('First segment coords:', data[0]?.coords);
          console.log('First segment street_code:', data[0]?.street_code);
          console.log('First segment municipality:', data[0]?.municipality);
          setSegments(data);
          console.log('Loaded ALL', data.length, 'segments from Vias_SantoDomingo_Split.shp');
          return;
        } else {
          console.error('Failed to load shapefile data, status:', response.status);
        }
      } catch (error) {
        console.error('Error loading shapefile data:', error);
      }

      // Fallback to sample data if full data fails
      try {
        const response = await fetch('/segments_sample.json');
        if (response.ok) {
          const data = await response.json();
          setSegments(data);
          console.log('Loaded', data.length, 'segments from sample data (fallback)');
          return;
        }
      } catch (error) {
        console.error('Error loading sample data:', error);
      }

      // Fallback to hardcoded data
      console.log('Using fallback hardcoded segments');
      const fallbackSegments: Segment[] = [
        {
          id: '1',
          name: 'Calle Principal',
          street_name: 'Calle Principal',
          street_code: 'DNX-001001',
          fclass: 'primary',
          coords: [[-69.75949665005032, 18.555373400112387], [-69.75849665005032, 18.556373400112387]],
          length: 150.5,
          municipality: 'DNX'
        },
        {
          id: '2',
          name: 'Avenida Central',
          street_name: 'Avenida Central',
          street_code: 'SDO-002001',
          fclass: 'secondary',
          coords: [[-69.76049665005032, 18.554373400112387], [-69.75949665005032, 18.555373400112387]],
          length: 200.3,
          municipality: 'SDO'
        }
      ];
      setSegments(fallbackSegments);
    } catch (error) {
      console.error('Error loading segments:', error);
      setError('Failed to load segments: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  return { segments, loading, error, reload: loadSegments };
};
