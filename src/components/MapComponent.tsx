import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Segment } from '../types/Segment';
import { getSegmentStyle, filterSegmentsInBounds } from '../utils/segmentUtils';

// Fix for default markers in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface MapComponentProps {
  segments: Segment[];
  onSegmentClick: (segment: Segment) => void;
  loading: boolean;
  onLoadSegments?: () => void;
}

const MapComponent: React.FC<MapComponentProps> = ({ segments, onSegmentClick, loading, onLoadSegments }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const guideMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const segmentLayerRef = useRef<L.LayerGroup | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(10);
  const [visibleSegments, setVisibleSegments] = useState<Segment[]>([]);
  const [guideMap, setGuideMap] = useState<L.Map | null>(null);
  const [highlightedSegment, setHighlightedSegment] = useState<Segment | null>(null);
  const highlightedLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [coordinateCaptureMode, setCoordinateCaptureMode] = useState<boolean>(false);
  const markersMapRef = useRef<Map<number, { marker: L.Marker; label?: L.Marker }>>(new Map());
  const currentPopupRef = useRef<L.Popup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Ensure the map container is properly sized
    if (mapRef.current.offsetWidth === 0 || mapRef.current.offsetHeight === 0) {
      console.warn('Map container has no dimensions, retrying...');
      setTimeout(() => {
        if (mapRef.current && !mapInstanceRef.current) {
          initializeMap();
        }
      }, 100);
      return;
    }

    const initializeMap = () => {
      const map = L.map(mapRef.current!, {
        center: [18.555373400112387, -69.75949665005032], // Santo Domingo center
        zoom: 12,
        zoomControl: true,
        preferCanvas: true, // Use canvas for better performance
      });

    // Add tile layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    });

    const cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO'
    });

    const esriLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    });

    const googleLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: '© Google'
    });

    const googleSatelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: '© Google'
    });

    const googleHybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      attribution: '© Google'
    });

    const googleTerrainLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
      attribution: '© Google'
    });

    // Add default layer
    osmLayer.addTo(map);

    // Add layer control
    const baseMaps = {
      'OpenStreetMap': osmLayer,
      'CartoDB': cartoLayer,
      'Esri Satellite': esriLayer,
      'Google Maps': googleLayer,
      'Google Satellite': googleSatelliteLayer,
      'Google Hybrid': googleHybridLayer,
      'Google Terrain': googleTerrainLayer,
    };

    L.control.layers(baseMaps).addTo(map);

    // Create segment layer
    const segmentLayer = L.layerGroup().addTo(map);
    segmentLayerRef.current = segmentLayer;

    // Create markers layer
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    // Add event listeners
    map.on('zoomend', () => {
      const zoom = map.getZoom();
      setCurrentZoom(zoom);
      loadSegmentsForCurrentView(map);
      
      // Update guide map
      if (guideMap && (guideMap as any).updateGuideMap) {
        (guideMap as any).updateGuideMap();
      }
    });

    map.on('moveend', () => {
      loadSegmentsForCurrentView(map);
      
      // Update guide map
      if (guideMap && (guideMap as any).updateGuideMap) {
        (guideMap as any).updateGuideMap();
      }
    });

      mapInstanceRef.current = map;
    };

    initializeMap();
  }, []);

  // Initialize guide map
  useEffect(() => {
    if (!guideMapRef.current || guideMap) return;

    try {
      const guideMapInstance = L.map(guideMapRef.current, {
        center: [18.555373400112387, -69.75949665005032],
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ''
      }).addTo(guideMapInstance);

      // Add Santo Domingo regions
      const regions = [
        { name: 'DNX', bounds: [[18.4, -69.9], [18.6, -69.7]] as [[number, number], [number, number]] },
        { name: 'SDO', bounds: [[18.5, -69.8], [18.7, -69.6]] as [[number, number], [number, number]] },
        { name: 'SDE', bounds: [[18.3, -69.8], [18.5, -69.6]] as [[number, number], [number, number]] },
        { name: 'SDN', bounds: [[18.6, -69.9], [18.8, -69.7]] as [[number, number], [number, number]] }
      ];

      regions.forEach(region => {
        L.rectangle(region.bounds, {
          color: '#3498db',
          weight: 2,
          fillColor: '#3498db',
          fillOpacity: 0.1
        }).addTo(guideMapInstance);
        
        const center: [number, number] = [
          (region.bounds[0][0] + region.bounds[1][0]) / 2,
          (region.bounds[0][1] + region.bounds[1][1]) / 2
        ];
        
        L.marker(center).addTo(guideMapInstance)
          .bindTooltip(region.name, { permanent: true, direction: 'center' });
      });

      // Add viewport rectangle to show current view
      const viewportRect = L.rectangle([[18.4, -69.9], [18.6, -69.7]], {
        color: '#e74c3c',
        weight: 3,
        fillColor: '#e74c3c',
        fillOpacity: 0.2
      }).addTo(guideMapInstance);

      // Store viewport rectangle reference
      (guideMapInstance as any).viewportRect = viewportRect;

      // Update guide map when main map moves
      const updateGuideMap = () => {
        if (mapInstanceRef.current && viewportRect) {
          try {
            const mainBounds = mapInstanceRef.current.getBounds();
            const mainCenter = mapInstanceRef.current.getCenter();
            const mainZoom = mapInstanceRef.current.getZoom();
            
            // Update the viewport rectangle to show current view
            viewportRect.setBounds(mainBounds);
            
            // Update guide map center and zoom to show current area
            guideMapInstance.setView(mainCenter, Math.max(8, mainZoom - 3));
            
            console.log('Guide map updated:', mainCenter, mainZoom);
          } catch (error) {
            console.warn('Guide map update error:', error);
          }
        }
      };

      // Store the update function for later use
      (guideMapInstance as any).updateGuideMap = updateGuideMap;

      setGuideMap(guideMapInstance);

      return () => {
        try {
          guideMapInstance.remove();
        } catch (error) {
          console.warn('Guide map cleanup error:', error);
        }
      };
    } catch (error) {
      console.error('Guide map initialization error:', error);
    }
  }, []);

  // Load segments based on zoom and bounds
  const loadSegmentsForCurrentView = useCallback((map: L.Map) => {
    console.log('=== LOADING SEGMENTS DEBUG ===');
    console.log('Segment layer exists:', !!segmentLayerRef.current);
    console.log('Total segments available:', segments.length);
    
    if (!segmentLayerRef.current) {
      console.error('No segment layer available!');
      return;
    }
    
    if (segments.length === 0) {
      console.error('No segments data available!');
      return;
    }

    const bounds = map.getBounds();
    const zoom = map.getZoom();

    console.log('Current zoom level:', zoom);
    console.log('Map bounds:', bounds.toString());

    // Only load segments if zoom level is 16 or higher
    if (zoom < 16) {
      setVisibleSegments([]);
      segmentLayerRef.current.clearLayers();
      console.log('Zoom level too low (need 16+), not loading segments');
      return;
    }
    
    console.log('Zoom level is', zoom, '- loading segments...');

    // Filter segments within current bounds
    const visibleSegs = filterSegmentsInBounds(segments, bounds);
    
    console.log('Segments in bounds:', visibleSegs.length);
    console.log('First few segments:', visibleSegs.slice(0, 3));

    setVisibleSegments(visibleSegs);

    // Clear existing layers
    segmentLayerRef.current.clearLayers();

    // Add segments to map
    console.log('Drawing', visibleSegs.length, 'segments on map...');
    let segmentsDrawn = 0;
    
    visibleSegs.forEach((segment, index) => {
      if (!segment.coords || segment.coords.length < 2) {
        console.log(`Skipping segment ${index} - no valid coords`);
        return;
      }

      const coords = segment.coords.map(([lon, lat]) => [lat, lon] as [number, number]);
      const style = getSegmentStyle(segment);
      
      console.log(`Drawing segment ${index}:`, segment.street_name || segment.street_code || segment.name, 'with coords:', coords.slice(0, 2));

      try {
        const polyline = L.polyline(coords, {
          color: style.color,
          weight: style.weight,
          opacity: style.opacity,
          lineCap: 'round',
          lineJoin: 'round'
        });

        // Add event listeners
        polyline.on('click', (e) => {
          onSegmentClick(segment);
          
          // Close any existing popup
          if (currentPopupRef.current) {
            currentPopupRef.current.close();
          }
          
          // Show popup on map with street code and name
          const popup = L.popup({
            closeButton: true,
            autoClose: true,
            closeOnClick: true,
            className: 'segment-popup'
          })
          .setLatLng(e.latlng)
          .setContent(`
            <div class="segment-popup-content">
              <div class="segment-code">${segment.street_code || 'N/A'}</div>
              <div class="segment-name">${segment.street_name || segment.name || 'N/A'}</div>
            </div>
          `)
          .openOn(mapInstanceRef.current!);
          
          // Store reference to current popup
          currentPopupRef.current = popup;
        });
        
        polyline.on('mouseover', function(this: L.Polyline) {
          this.setStyle({ color: '#FF4500', weight: style.weight + 1 });
        });
        
        polyline.on('mouseout', function(this: L.Polyline) {
          this.setStyle({ color: style.color, weight: style.weight });
        });

        segmentLayerRef.current!.addLayer(polyline);
        segmentsDrawn++;
        console.log(`Successfully added segment ${index} to map`);
      } catch (error) {
        console.error(`Error drawing segment ${index}:`, error);
      }
    });
    
    console.log(`Drew ${segmentsDrawn} segments on map`);
  }, [segments, onSegmentClick]);


  // Load segments when they change
  useEffect(() => {
    if (mapInstanceRef.current && segments.length > 0) {
      // Add a small delay to ensure map is fully initialized
      setTimeout(() => {
        if (mapInstanceRef.current) {
          loadSegmentsForCurrentView(mapInstanceRef.current);
        }
      }, 500);
    }
  }, [segments, loadSegmentsForCurrentView]);

  // Expose loadSegmentsForCurrentView to parent component
  useEffect(() => {
    if (onLoadSegments && mapInstanceRef.current) {
      // Replace the parent's onLoadSegments with our function
      (window as any).loadSegmentsForCurrentView = () => {
        if (mapInstanceRef.current) {
          loadSegmentsForCurrentView(mapInstanceRef.current);
        }
      };
    }
  }, [onLoadSegments, loadSegmentsForCurrentView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight segment function
  const highlightSegment = useCallback((segment: Segment) => {
    if (!mapInstanceRef.current || !segment.coords || segment.coords.length < 2) {
      console.log('Cannot highlight segment - no map or invalid coords');
      return;
    }

    // Remove previous highlight
    if (highlightedLayerRef.current) {
      mapInstanceRef.current.removeLayer(highlightedLayerRef.current);
    }

    // Create highlighted version with red thick line
    const coords = segment.coords.map(([lon, lat]) => [lat, lon] as [number, number]);
    const highlightedPolyline = L.polyline(coords, {
      color: '#FF0000', // Red color
      weight: 8, // Thick line
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    });

    highlightedLayerRef.current = highlightedPolyline;
    mapInstanceRef.current.addLayer(highlightedPolyline);
    setHighlightedSegment(segment);
    
    console.log('Segment highlighted:', segment.street_name || segment.street_code || segment.name);
  }, []);

  // Unhighlight segment function
  const unhighlightSegment = useCallback(() => {
    if (highlightedLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(highlightedLayerRef.current);
      highlightedLayerRef.current = null;
    }
    setHighlightedSegment(null);
    console.log('Segment unhighlighted');
  }, []);

  // Recenter map to segment function
  const recenterMapToSegment = useCallback((segment: Segment, zoomLevel: number = 18) => {
    if (!mapInstanceRef.current || !segment.coords || segment.coords.length < 2) {
      console.log('Cannot recenter - no map or invalid coords');
      return;
    }

    // Calculate center of segment
    const coords = segment.coords.map(([lon, lat]) => [lat, lon] as [number, number]);
    let totalLat = 0;
    let totalLon = 0;
    
    coords.forEach(([lat, lon]) => {
      totalLat += lat;
      totalLon += lon;
    });
    
    const centerLat = totalLat / coords.length;
    const centerLon = totalLon / coords.length;
    
    // Recenter map
    mapInstanceRef.current.setView([centerLat, centerLon], zoomLevel);
    
    console.log(`Map recentered to segment at zoom ${zoomLevel}:`, [centerLat, centerLon]);
  }, []);

  // Add marker to map with sequence
  const addMarkerToMapWithSequence = useCallback((lat: number, lng: number, name: string, pointId: number, sequence?: number) => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const marker = L.marker([lat, lng]).addTo(markersLayerRef.current);
    
    // Calculate closest segment for the popup - PROPER HAVERSINE APPROACH
    const calculateClosestForPopup = () => {
      const segments = (window as any).segmentsData || [];
      console.log(`[MapComponent] Calculating closest segment for popup at (${lat}, ${lng})`);
      console.log(`[MapComponent] Available segments: ${segments.length}`);
      
      if (segments.length === 0) {
        return { segmentCode: 'N/A', distance: 'N/A', streetName: 'N/A' };
      }

      const pointLat = lat;
      const pointLng = lng;
      let minDistance = Infinity;
      let closestSeg = null;
      
      // Haversine distance function
      const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };
      
      // TRUE point-to-line distance calculation
      const pointToLineDistance = (pointLat: number, pointLng: number, segLat1: number, segLng1: number, segLat2: number, segLng2: number): number => {
        // Convert to approximate meters for Santo Domingo
        const toMeters = (lat: number, lng: number) => {
          const x = (lng - (-70)) * 111320 * Math.cos(lat * Math.PI / 180);
          const y = (lat - 18.5) * 111320;
          return { x, y };
        };
        
        const point = toMeters(pointLat, pointLng);
        const seg1 = toMeters(segLat1, segLng1);
        const seg2 = toMeters(segLat2, segLng2);
        
        // Calculate point-to-line distance using geometric projection
        const A = point.x - seg1.x;
        const B = point.y - seg1.y;
        const C = seg2.x - seg1.x;
        const D = seg2.y - seg1.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) {
          // Line segment is a point
          return Math.sqrt(A * A + B * B);
        }
        
        let param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
          xx = seg1.x;
          yy = seg1.y;
        } else if (param > 1) {
          xx = seg2.x;
          yy = seg2.y;
        } else {
          xx = seg1.x + param * C;
          yy = seg1.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
      };
      
      // First, filter segments by proximity using bounding box
      const searchRadius = 0.01; // ~1km radius in degrees
      const nearbySegments = segments.filter((segment: any) => {
        if (!segment.coords || segment.coords.length < 2) return false;
        
        // Check if any point in segment is within search radius
        return segment.coords.some(([lng, lat]: [number, number]) => {
          const latDiff = Math.abs(lat - pointLat);
          const lngDiff = Math.abs(lng - pointLng);
          return latDiff < searchRadius && lngDiff < searchRadius;
        });
      });
      
      console.log(`[MapComponent] Found ${nearbySegments.length} nearby segments out of ${segments.length} total`);
      
      // Check nearby segments for closest one using point-to-line distance
      for (let i = 0; i < nearbySegments.length; i++) {
        const segment = nearbySegments[i];
        
        // Get coordinates from segment
        let coords = null;
        if (segment && segment.coords) {
          coords = segment.coords;
        } else if (segment && segment.geometry && segment.geometry.coordinates) {
          coords = segment.geometry.coordinates;
        }
        
        if (coords && Array.isArray(coords) && coords.length >= 2) {
          // Calculate distance to each line segment in the road
          for (let j = 0; j < coords.length - 1; j++) {
            const [segLng1, segLat1] = coords[j];
            const [segLng2, segLat2] = coords[j + 1];
            
            // Skip invalid coordinates
            if (isNaN(segLat1) || isNaN(segLng1) || isNaN(segLat2) || isNaN(segLng2) || 
                isNaN(pointLat) || isNaN(pointLng)) {
              continue;
            }
            
            // Use point-to-line distance for more accurate calculation
            const dist = pointToLineDistance(pointLat, pointLng, segLat1, segLng1, segLat2, segLng2);
            
            if (dist < minDistance) {
              minDistance = dist;
              closestSeg = segment;
              console.log(`[MapComponent] New closest segment: ${segment.street_code || segment.id}, distance: ${dist.toFixed(2)}m`);
            }
          }
        }
      }
      
      if (closestSeg && minDistance !== Infinity) {
        const municipality = closestSeg.municipality || 'DNX';
        const streetCode = closestSeg.street_code || '000000';
        const streetName = closestSeg.street_name || closestSeg.name || 'N/A';
        const distance = `${minDistance.toFixed(2)}m`;
        console.log(`[MapComponent] Found closest segment: ${municipality}-${streetCode}, street name: ${streetName}, distance: ${distance}`);
        return { segmentCode: `${municipality}-${streetCode}`, distance, streetName };
      }
      
      return { segmentCode: 'N/A', distance: 'N/A', streetName: 'N/A' };
    };

    // Simple Haversine distance calculation
    const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371000; // Earth's radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // Helper function to calculate distance from point to line segment using Haversine formula
    const pointToLineDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
      // Haversine distance between two points in meters
      const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      // Distance from point to line segment using proper geographic calculation
      const A = haversineDistance(px, py, x1, y1);
      const B = haversineDistance(px, py, x2, y2);
      const C = haversineDistance(x1, y1, x2, y2);
      
      // If the line segment is very short, return the minimum distance to endpoints
      if (C < 1) { // Less than 1 meter
        return Math.min(A, B);
      }
      
      // Use the formula for distance from point to line segment
      // This is an approximation for geographic coordinates
      const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / (C * C)));
      const projectionLat = x1 + t * (x2 - x1);
      const projectionLon = y1 + t * (y2 - y1);
      
      return haversineDistance(px, py, projectionLat, projectionLon);
    };

    // Calculate closest segment and create popup
    const result = calculateClosestForPopup();
    const streetName = result.streetName || 'N/A';
    marker.bindPopup(`<b>${name}</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}<br><b>Closest Segment:</b> ${result.segmentCode}<br><b>Street Name:</b> ${streetName}<br><b>Distance:</b> ${result.distance}`);
    
    // Add sequence number as a label if provided
    if (sequence) {
      const label = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'sequence-label',
          html: `<div style="
            background: #e74c3c;
            color: white;
            border-radius: 50%;
            width: 25px;
            height: 25px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${sequence}</div>`,
          iconSize: [25, 25],
          iconAnchor: [12, 12]
        })
      }).addTo(markersLayerRef.current);
      
      // Store both markers for removal
      markersMapRef.current.set(pointId, { marker, label });
      console.log(`[MapComponent] Stored marker data for pointId ${pointId}:`, { marker, label });
    } else {
      markersMapRef.current.set(pointId, { marker });
      console.log(`[MapComponent] Stored marker data for pointId ${pointId}:`, { marker });
    }
    
    console.log('Marker added with sequence:', lat, lng, name, pointId, sequence);
  }, []);

  // Add marker to map (legacy function)
  const addMarkerToMap = useCallback((lat: number, lng: number, name?: string) => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const marker = L.marker([lat, lng]).addTo(markersLayerRef.current);
    
    if (name) {
      marker.bindPopup(`<b>${name}</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`);
    } else {
      marker.bindPopup(`<b>Punto</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`);
    }
    
    console.log('Marker added:', lat, lng, name);
  }, []);

  // Add multiple markers to map
  const addMultipleMarkersToMap = useCallback((points: Array<{lat: number, lng: number, name?: string}>) => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    points.forEach(point => {
      addMarkerToMap(point.lat, point.lng, point.name);
    });

    // Fit map to show all markers
    if (points.length > 0) {
      const group = L.featureGroup();
      points.forEach(point => {
        group.addLayer(L.marker([point.lat, point.lng]));
      });
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }

    console.log('Multiple markers added:', points.length);
  }, [addMarkerToMap]);

  // Enable coordinate capture mode
  const enableCoordinateCapture = useCallback(() => {
    if (!mapInstanceRef.current) return;
    
    setCoordinateCaptureMode(true);
    
    const map = mapInstanceRef.current;
    map.getContainer().style.cursor = 'crosshair';
    
    const clickHandler = (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      
      // Fill the coordinate inputs in the sidebar
      if ((window as any).fillCoordinates) {
        (window as any).fillCoordinates(lat, lng);
      }
      
      // Automatically add point to table via global function
      if ((window as any).addPointFromMapClick) {
        (window as any).addPointFromMapClick(lat, lng);
      }
      
      // Disable coordinate capture mode
      setCoordinateCaptureMode(false);
      map.getContainer().style.cursor = '';
      map.off('click', clickHandler);
    };
    
    map.on('click', clickHandler);
  }, []);

  // Remove marker from map
  const removeMarkerFromMap = useCallback((pointId: number) => {
    console.log(`[MapComponent] Attempting to remove marker for pointId: ${pointId}`);
    const markerData = markersMapRef.current.get(pointId);
    console.log(`[MapComponent] Found markerData for pointId ${pointId}:`, markerData);
    
    if (markerData && markersLayerRef.current) {
      // Remove the main marker
      if (markerData.marker) {
        try {
          markersLayerRef.current.removeLayer(markerData.marker);
          console.log(`[MapComponent] Successfully removed main marker for pointId: ${pointId}`);
        } catch (error) {
          console.error(`[MapComponent] Error removing main marker for pointId ${pointId}:`, error);
        }
      } else {
        console.log(`[MapComponent] No main marker found for pointId: ${pointId}`);
      }
      
      // Remove the sequence label if it exists
      if (markerData.label) {
        try {
          markersLayerRef.current.removeLayer(markerData.label);
          console.log(`[MapComponent] Successfully removed label marker for pointId: ${pointId}`);
        } catch (error) {
          console.error(`[MapComponent] Error removing label marker for pointId ${pointId}:`, error);
        }
      } else {
        console.log(`[MapComponent] No label marker found for pointId: ${pointId}`);
      }
      
      // Remove from the map reference
      markersMapRef.current.delete(pointId);
      console.log(`[MapComponent] Deleted entry from markersMapRef for pointId: ${pointId}`);
    } else {
      console.log(`[MapComponent] Marker data or layer ref not found for pointId: ${pointId}`);
    }
  }, []);

  // Fill coordinates in sidebar
  const fillCoordinates = useCallback((lat: number, lng: number) => {
    // This will be called by the sidebar to update the input fields
    console.log('Filling coordinates:', lat, lng);
  }, []);

  // Expose functions and data globally
  useEffect(() => {
    (window as any).highlightSegment = highlightSegment;
    (window as any).unhighlightSegment = unhighlightSegment;
    (window as any).recenterMapToSegment = recenterMapToSegment;
    (window as any).addMarkerToMap = addMarkerToMap;
    (window as any).addMarkerToMapWithSequence = addMarkerToMapWithSequence;
    (window as any).addMultipleMarkersToMap = addMultipleMarkersToMap;
    (window as any).addMarkersToMap = addMultipleMarkersToMap; // Alias for App.tsx
    (window as any).removeMarkerFromMap = removeMarkerFromMap;
    (window as any).enableCoordinateCapture = enableCoordinateCapture;
    (window as any).fillCoordinates = fillCoordinates;
    (window as any).segmentsData = segments; // Expose segments data for distance calculations
    
    // Debug: Log segments data availability
    console.log(`[MapComponent] Exposing segments data: ${segments.length} segments`);
    if (segments.length > 0) {
      console.log(`[MapComponent] First segment structure:`, segments[0]);
    }
  }, [highlightSegment, unhighlightSegment, recenterMapToSegment, addMarkerToMap, addMarkerToMapWithSequence, addMultipleMarkersToMap, removeMarkerFromMap, enableCoordinateCapture, fillCoordinates, segments]);

  return (
    <div className="map-container">
      <div ref={mapRef} className="map" />
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Loading segments...</div>
        </div>
      )}
      <div className="zoom-info">
        Zoom: {currentZoom} | Segments: {visibleSegments.length} | Total: {segments.length} | (Need zoom 16+)
      </div>
      
      
      {/* Guide Map */}
      <div className="guide-map">
        <div className="guide-map-title">Santo Domingo Regions</div>
        <div ref={guideMapRef} style={{height: '120px', width: '100%'}}></div>
      </div>
    </div>
  );
};

export default MapComponent;
