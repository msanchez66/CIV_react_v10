import React, { useState, useEffect } from 'react';
import { Segment } from '../types/Segment';

interface SidebarProps {
  selectedSegment: Segment | null;
  onSearch: (query: string) => void;
  searchQuery: string;
  onClearSelection: () => void;
  onLoadSegments: () => void;
  statistics: { maxLength: number; minLength: number };
  activeMenu: string;
  onSearchByCode: (municipality: string, code: string) => void;
  onAddPoint: (lat: number, lng: number, name?: string) => void;
  onUploadPoints: (points: Array<{lat: number, lng: number, name?: string, referencia?: string}>) => void;
  pointsList: Array<{id: number, name: string, lat: number, lng: number, sequence: number, referencia?: string}>;
  onDeletePoint: (pointId: number) => void;
  onFillCoordinates?: (lat: number, lng: number) => void;
  groupPoints: Array<{id: number, name: string, lat: number, lng: number, sequence: number, referencia?: string}>;
  setGroupPoints: React.Dispatch<React.SetStateAction<Array<{id: number, name: string, lat: number, lng: number, sequence: number, referencia?: string}>>>;
  paginationStart: number;
  selectedAction: string;
  setSelectedAction: React.Dispatch<React.SetStateAction<string>>;
  setPaginationStart: React.Dispatch<React.SetStateAction<number>>;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  selectedSegment, 
  onSearch, 
  searchQuery, 
  onClearSelection,
  onLoadSegments,
  statistics,
  activeMenu,
  onSearchByCode,
  onAddPoint,
  onUploadPoints,
  pointsList,
  onDeletePoint,
  onFillCoordinates,
  groupPoints,
  setGroupPoints,
  paginationStart,
  setPaginationStart,
  selectedAction,
  setSelectedAction
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [municipality, setMunicipality] = useState<string>('DNX');
  const [code, setCode] = useState<string>('');
  
  // Localization state
  const [latitude, setLatitude] = useState<string>('');

  // File handling functions
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      let points: Array<{lat: number, lng: number, name?: string, referencia?: string}> = [];
      
      if (file.name.endsWith('.csv')) {
        // Parse CSV
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length >= 3) {
            const lat = parseFloat(values[headers.indexOf('latitude')]);
            const lng = parseFloat(values[headers.indexOf('longitude')]);
            const name = values[headers.indexOf('nombre')] || `Punto ${i}`;
            const referencia = values[headers.indexOf('referencia')] || `REF-${i.toString().padStart(8, '0')}`;
            
            if (!isNaN(lat) && !isNaN(lng)) {
              points.push({ lat, lng, name, referencia });
            }
          }
        }
      } else if (file.name.endsWith('.xlsx')) {
        // For XLSX, we'll need to use a library like xlsx
        // For now, let's show an alert that XLSX support needs to be added
        alert('XLSX support will be added. Please use CSV format for now.');
        return;
      }
      
      if (points.length > 0) {
        // Add points to group points with sequence numbers
        const newGroupPoints = points.map((point, index) => ({
          id: Date.now() + index,
          name: point.name || `Punto ${index + 1}`,
          lat: point.lat,
          lng: point.lng,
          sequence: groupPoints.length + index + 1,
          referencia: point.referencia
        }));
        
        setGroupPoints(prev => [...prev, ...newGroupPoints]);
        
        // Also add to the main points list
        onUploadPoints(points);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading file. Please check the format.');
    }
  };

  const generateReport = () => {
    if (groupPoints.length === 0) {
      alert('No hay puntos para generar el reporte.');
      return;
    }
    
    const filename = prompt('Ingrese el nombre del archivo para el reporte:');
    if (!filename) return;
    
    // Calculate closest segments for all points
    const reportData = groupPoints.map(point => {
      const closest = calculateClosestSegment(point);
      return {
        'No': point.sequence,
        'Ref punto': point.referencia || point.name,
        'Nombre calle': closest.streetName || 'N/A',
        'Segment code': closest.segmentCode,
        'Distance': closest.distance,
        'Latitude': point.lat,
        'Longitude': point.lng
      };
    });
    
    // Create CSV content
    const csvContent = [
      'No,Ref punto,Nombre calle,Segment code,Distance,Latitude,Longitude',
      ...reportData.map(row => `"${row['No']}","${row['Ref punto']}","${row['Nombre calle']}","${row['Segment code']}","${row['Distance']}","${row['Latitude']}","${row['Longitude']}"`)
    ].join('\n');
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  const [longitude, setLongitude] = useState<string>('');
  const [pointName, setPointName] = useState<string>('');

  const handleSearchByCode = () => {
    if (code.trim()) {
      onSearchByCode(municipality, code.trim());
    }
  };

  const handleAddPoint = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      onAddPoint(lat, lng, pointName.trim() || undefined);
      setLatitude('');
      setLongitude('');
      setPointName('');
    } else {
      alert('Por favor ingrese coordenadas válidas');
    }
  };

  // Function to fill coordinates from map click
  const fillCoordinates = (lat: number, lng: number) => {
    setLatitude(lat.toString());
    setLongitude(lng.toString());
  };

  // Function to automatically add point from map click
  const addPointFromMapClick = (lat: number, lng: number) => {
    const name = pointName.trim() || undefined;
    onAddPoint(lat, lng, name);
    setLatitude('');
    setLongitude('');
    setPointName('');
  };

  // Expose functions globally for MapComponent
  useEffect(() => {
    (window as any).fillCoordinates = fillCoordinates;
    (window as any).addPointFromMapClick = addPointFromMapClick;
  }, [pointName, onAddPoint]);

  const handleCreateReport = () => {
    if (pointsList.length === 0) {
      alert('No hay puntos para crear el reporte');
      return;
    }

    const filename = prompt('Ingrese el nombre del archivo (sin extensión):');
    if (!filename) return;

    // Get segments data from global window object
    const segments = (window as any).segmentsData || [];
    
    const reportData = pointsList.map((point) => {
      let closestSegment = 'N/A';
      let distance = 'N/A';
      let closestSeg = null;
      
      if (segments.length > 0) {
        let minDistance = Infinity;
        
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
            const latDiff = Math.abs(lat - point.lat);
            const lngDiff = Math.abs(lng - point.lng);
            return latDiff < searchRadius && lngDiff < searchRadius;
          });
        });
        
        console.log(`[Sidebar] Found ${nearbySegments.length} nearby segments out of ${segments.length} total`);
        
        // Check nearby segments for closest one using point-to-line distance
        for (const segment of nearbySegments) {
          if (segment.coords && segment.coords.length >= 2) {
            // Calculate distance to each line segment in the road
            for (let j = 0; j < segment.coords.length - 1; j++) {
              const [lng1, lat1] = segment.coords[j];
              const [lng2, lat2] = segment.coords[j + 1];
              
              // Use point-to-line distance for more accurate calculation
              const dist = pointToLineDistance(point.lat, point.lng, lat1, lng1, lat2, lng2);
              
              if (dist < minDistance) {
                minDistance = dist;
                closestSeg = segment;
                console.log(`[Sidebar] New closest segment: ${segment.street_code || segment.id}, distance: ${dist.toFixed(2)}m`);
              }
            }
          }
        }
        
        if (closestSeg) {
          const municipality = closestSeg.municipality || 'DNX';
          const streetCode = closestSeg.street_code || '000000';
          closestSegment = `${municipality}-${streetCode}`;
          distance = `${minDistance.toFixed(2)}m`;
        }
      }
      
      return {
        No: point.sequence,
        'Ref punto': point.referencia || point.name,
        'Nombre calle': closestSeg ? (closestSeg.street_name || closestSeg.name || 'N/A') : 'N/A',
        'Segment code': closestSegment,
        Distance: distance,
        Latitude: point.lat,
        Longitude: point.lng
      };
    });

    // Create CSV content
    const csvContent = [
      'No,Ref punto,Nombre calle,Segment code,Distance,Latitude,Longitude',
      ...reportData.map(point => 
        `${point.No},"${point['Ref punto']}","${point['Nombre calle']}","${point['Segment code']}","${point.Distance}",${point.Latitude},${point.Longitude}`
      )
    ].join('\n');

    // Download CSV
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const csvLink = document.createElement('a');
    csvLink.href = URL.createObjectURL(csvBlob);
    csvLink.download = `${filename}.csv`;
    csvLink.click();

    alert('Reporte creado exitosamente');
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      parseFileContent(content, file.name);
    };
    reader.readAsText(file);
  };


  // Download points to CSV/XLSX
  const downloadPointsToFile = async (filename: string) => {
    if (pointsList.length === 0) {
      alert('No hay puntos para descargar');
      return;
    }

    // Get segments data from global window object (set by MapComponent)
    const segments = (window as any).segmentsData || [];
    console.log(`[Sidebar] Segments data available for download: ${segments.length} segments`);
    
    // Calculate closest segments for each point
    const pointsWithClosestSegments = pointsList.map((point) => {
      let closestSegment = 'N/A';
      let distance = 'N/A';
      
      if (segments.length > 0) {
        try {
          // Simple distance calculation
          let minDistance = Infinity;
          let closestSeg = null;
          
          for (const segment of segments.slice(0, 1000)) { // Check first 1000 segments
            if (segment.coords && segment.coords.length > 0) {
              for (const coord of segment.coords) {
                const [lng, lat] = coord;
                const dist = Math.sqrt(
                  Math.pow(point.lat - lat, 2) + Math.pow(point.lng - lng, 2)
                ) * 111000; // Rough conversion to meters
                
                if (dist < minDistance) {
                  minDistance = dist;
                  closestSeg = segment;
                }
              }
            }
          }
          
          if (closestSeg) {
            const municipality = closestSeg.municipality || 'UNK';
            const streetCode = closestSeg.street_code || '000000';
            closestSegment = `${municipality}-${streetCode}`;
            distance = `${minDistance.toFixed(2)}m`;
          }
        } catch (error) {
          console.error(`[Sidebar] Error finding closest segment for point ${point.id}:`, error);
        }
      }
      
      return {
        Number: point.sequence,
        Reference: point.referencia || `REF-${point.sequence.toString().padStart(8, '0')}`,
        Name: point.name,
        Latitude: point.lat,
        Longitude: point.lng,
        'Closest segment': closestSegment,
        'Distance to closest segment': distance
      };
    });

    // Create CSV content with all required columns
    const csvContent = [
      'Number,Reference,Nombre,Latitude,Longitude,Closest segment,Distance to closest segment',
      ...pointsWithClosestSegments.map(point => 
        `${point.Number},"${point.Reference}","${point.Name}",${point.Latitude},${point.Longitude},"${point['Closest segment']}","${point['Distance to closest segment']}"`
      )
    ].join('\n');

    // Download CSV
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const csvLink = document.createElement('a');
    csvLink.href = URL.createObjectURL(csvBlob);
    csvLink.download = `${filename}.csv`;
    csvLink.click();

    alert('Archivo descargado exitosamente');
  };

  // Clear all points
  const clearAllPoints = () => {
    // Clear all markers from map
    pointsList.forEach(point => {
      if ((window as any).removeMarkerFromMap) {
        (window as any).removeMarkerFromMap(point.id);
      }
    });
    // Clear points list (this will be handled by the parent component)
    if ((window as any).clearAllPointsFromApp) {
      (window as any).clearAllPointsFromApp();
    }
  };

  // Calculate closest segment for a point
  const calculateClosestSegment = (point: any) => {
    const segments = (window as any).segmentsData || [];
    console.log(`[Sidebar] Calculating closest segment for point:`, point);
    console.log(`[Sidebar] Available segments:`, segments.length);
    if (segments.length === 0) {
      console.log(`[Sidebar] No segments available`);
      return { segmentCode: 'N/A', distance: 'N/A', streetName: 'N/A' };
    }

    let minDistance = Infinity;
    let closestSeg = null;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      let coords = null;
      if (segment && segment.coords) {
        coords = segment.coords;
      } else if (segment && segment.geometry && segment.geometry.coordinates) {
        coords = segment.geometry.coordinates;
      }
      
      if (coords && Array.isArray(coords)) {
        for (const coord of coords) {
          if (Array.isArray(coord) && coord.length >= 2) {
            const [lng, lat] = coord;
            
            if (isNaN(lat) || isNaN(lng) || isNaN(point.lat) || isNaN(point.lng)) {
              continue;
            }
            
            const dx = point.lat - lat;
            const dy = point.lng - lng;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minDistance) {
              minDistance = dist;
              closestSeg = segment;
            }
          }
        }
      }
    }
    
    if (closestSeg && minDistance !== Infinity) {
      const streetCode = closestSeg.street_code || '000000';
      const municipality = closestSeg.municipality || 'DNX';
      const segmentCode = `${municipality}-${streetCode}`;
      const streetName = closestSeg.street_name || closestSeg.name || 'N/A';
      // Convert to approximate meters (1 degree ≈ 111km)
      const distanceMeters = minDistance * 111000;
      const distance = `${distanceMeters.toFixed(2)}m`;
      console.log(`[Sidebar] Found closest segment:`, { segmentCode, distance, streetName });
      return { segmentCode, distance, streetName };
    }
    
    console.log(`[Sidebar] No closest segment found`);
    return { segmentCode: 'N/A', distance: 'N/A', streetName: 'N/A' };
  };

  // Update closest segment info display
  const updateClosestSegmentInfo = (point: any) => {
    const result = calculateClosestSegment(point);
    const codeElement = document.getElementById('closest-segment-code');
    const distanceElement = document.getElementById('closest-segment-distance');
    
    if (codeElement) codeElement.textContent = result.segmentCode;
    if (distanceElement) distanceElement.textContent = result.distance;
  };

  // Update closest segment info when points change
  useEffect(() => {
    if (pointsList.length > 0) {
      const lastPoint = pointsList[pointsList.length - 1];
      console.log(`[Sidebar] Updating closest segment info for point:`, lastPoint);
      // Add a small delay to ensure segments data is available
      setTimeout(() => {
        updateClosestSegmentInfo(lastPoint);
      }, 100);
    }
  }, [pointsList]);

  const parseFileContent = (content: string, filename: string) => {
    try {
      const lines = content.split('\n').filter(line => line.trim());
      const points: Array<{lat: number, lng: number, name?: string, referencia?: string}> = [];
      
      // Check if it's a proper CSV with headers
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const latIndex = headers.indexOf('latitude');
        const lngIndex = headers.indexOf('longitude');
        const nameIndex = headers.indexOf('nombre');
        const refIndex = headers.indexOf('referencia');
        
        if (latIndex !== -1 && lngIndex !== -1) {
          // Process data rows
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length > Math.max(latIndex, lngIndex)) {
              const lat = parseFloat(values[latIndex]);
              const lng = parseFloat(values[lngIndex]);
              const name = nameIndex !== -1 ? values[nameIndex] : `Punto ${i}`;
              const referencia = refIndex !== -1 ? values[refIndex] : `REF-${i.toString().padStart(8, '0')}`;
              
              if (!isNaN(lat) && !isNaN(lng)) {
                points.push({ lat, lng, name, referencia });
              }
            }
          }
        } else {
          // Fallback to simple format (lat, lng, name)
          lines.forEach((line, index) => {
            const parts = line.split(',').map(part => part.trim());
            if (parts.length >= 2) {
              const lat = parseFloat(parts[0]);
              const lng = parseFloat(parts[1]);
              const name = parts[2] || `Punto ${index + 1}`;
              
              if (!isNaN(lat) && !isNaN(lng)) {
                points.push({ lat, lng, name, referencia: `REF-${(index + 1).toString().padStart(8, '0')}` });
              }
            }
          });
        }
      }
      
      if (points.length > 0) {
        onUploadPoints(points);
        alert(`Se cargaron ${points.length} puntos desde el archivo`);
      } else {
        alert('No se encontraron coordenadas válidas en el archivo');
      }
    } catch (error) {
      alert('Error al procesar el archivo');
    }
  };

  const [selectedAction, setSelectedAction] = useState<'actualizar' | 'ver'>('actualizar');

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        {/* Header content removed as requested */}
      </div>

      {/* Window descriptions */}
      {activeMenu === 'Home' && (
        <div className="window-description">
          <h5>Descripción</h5>
          <p>En este ventana podrá encontrar y descargar toda la información sobre un segmento o un grupo de segmentos</p>
        </div>
      )}

      {activeMenu === 'Search' && (
        <div className="window-description">
          <h5>Descripción</h5>
          <p>En esta ventana podrá buscar un segmento y descargar toda la información disponible</p>
        </div>
      )}

      {activeMenu === 'Localización puntos' && (
        <div className="window-description">
          <h5>Descripción</h5>
          <p>En esta ventana podrá localizar y descargar información sobre uno o varios puntos especificos de manera individual, y asignarlos al segmento más cercano</p>
        </div>
      )}

      {activeMenu === 'Localización grupal' && (
        <div className="window-description">
          <h5>Descripción</h5>
          <p>En esta ventana podrá localizar y descargar información sobre todos los puntos incluidos en un archivo externo.</p>
        </div>
      )}

      <div className="load-segments-section">
        <button 
          className="load-segments-btn"
          onClick={onLoadSegments}
        >
          Cargar segmentos (zoom 16+)
        </button>
      </div>

      {activeMenu !== 'Search' && activeMenu !== 'Localización puntos' && activeMenu !== 'Localización grupal' && (
        <div className="statistics">
          <h4>Estadísticas de la red</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <label>Total Segments:</label>
              <span>124,476</span>
            </div>
            <div className="stat-item">
              <label>Total Length:</label>
              <span>10714.2 km</span>
            </div>
            <div className="stat-item">
              <label>Max Length:</label>
              <span>18990.69m</span>
            </div>
            <div className="stat-item">
              <label>Min Length (roads &gt; 10m):</label>
              <span>10.00m</span>
            </div>
          </div>
        </div>
      )}


      {activeMenu === 'Search' && (
        <div className="search-section">
          <h4>🔍 Opciones de búsqueda</h4>
          
          <div className="search-by-name">
            <label>Búsqueda por nombre de la vía</label>
            <input
              type="text"
              placeholder="Enter street name (e.g., 'Avenida Independencia')"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="search-input"
            />
            <button className="search-button">
              Búsqueda por nombre
            </button>
          </div>
          
          <div className="search-by-code">
            <label>Búsqueda por código de la vía</label>
            <div className="code-inputs">
              <select 
                className="municipality-select"
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
              >
                <option value="DNX">DNX</option>
                <option value="SDO">SDO</option>
                <option value="SDE">SDE</option>
                <option value="SDN">SDN</option>
              </select>
              <span>-</span>
              <input
                type="text"
                placeholder="000001"
                className="code-input"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <button 
              className="search-button"
              onClick={handleSearchByCode}
            >
              Búsqueda por código
            </button>
          </div>
          
          <div className="search-actions">
            <button className="clear-search-btn">🗑️ Borrar búsqueda</button>
            <button className="export-button">📤 Exportar</button>
          </div>
        </div>
      )}

      {activeMenu === 'Localización puntos' && (
        <div className="localization-section">
          <h4>📍 Localización de Puntos</h4>
          
          {/* Point Name Input */}
          <div className="point-name-section">
            <label>Nombre/Referencia del punto:</label>
            <input
              type="text"
              placeholder="Nombre del punto (opcional)"
              value={pointName}
              onChange={(e) => setPointName(e.target.value)}
              className="coord-input"
            />
          </div>
          
          {/* Map Selection */}
          <div className="map-selection-section">
            <h5>Obtener coordenadas del mapa</h5>
            <button 
              className="mark-point-btn"
              onClick={() => {
                if ((window as any).enableCoordinateCapture) {
                  (window as any).enableCoordinateCapture();
                }
              }}
            >
              Marcar punto en el mapa
            </button>
          </div>
          
          {/* Manual Coordinates */}
          <div className="manual-coords-section">
            <h5>Ingresar coordenadas directamente</h5>
            <div className="coordinate-inputs">
              <div className="coord-input-group">
                <label>Latitud:</label>
                <input
                  type="number"
                  step="any"
                  placeholder="18.555373"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="coord-input"
                />
              </div>
              <div className="coord-input-group">
                <label>Longitud:</label>
                <input
                  type="number"
                  step="any"
                  placeholder="-69.759496"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="coord-input"
                />
              </div>
            </div>
            <button 
              className="add-point-btn"
              onClick={handleAddPoint}
            >
              Agregar Punto
            </button>
          </div>
          
          {/* Points Table - EXACTLY as requested */}
          {pointsList.length > 0 && (
            <div className="points-table-section">
              <h5>Puntos seleccionados</h5>
              <table className="points-table">
                <thead>
                  <tr>
                    <th style={{width: '3ch', textAlign: 'left'}}>No</th>
                    <th style={{textAlign: 'left'}}>Nombre</th>
                    <th style={{width: '6ch', textAlign: 'right'}}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pointsList.map((point) => (
                    <tr key={point.id}>
                      <td style={{textAlign: 'left'}}>{point.sequence}</td>
                      <td style={{textAlign: 'left'}}>{point.name}</td>
                      <td style={{textAlign: 'right'}}>
                        <button 
                          className="delete-point-btn"
                          onClick={() => onDeletePoint(point.id)}
                          title="Eliminar punto"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Report Button */}
              <div className="report-section">
                <button 
                  className="report-btn"
                  onClick={handleCreateReport}
                >
                  Crear reporte
                </button>
              </div>
              
              {/* Clear All Points Button */}
              <div className="clear-section">
                <button 
                  className="clear-all-btn"
                  onClick={() => {
                    if (window.confirm('¿Está seguro que quiere borrar todos los puntos?')) {
                      clearAllPoints();
                    }
                  }}
                >
                  🗑️ Borrar puntos
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeMenu === 'Localización grupal' && (
        <div className="localization-section">
          <h4>📍 Localización Grupal</h4>
          
          {/* File Upload */}
          <div className="file-upload-section">
            <h5>Cargar Múltiples Puntos</h5>
            <div 
              className={`file-drop-zone ${isDragOver ? 'drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="drop-zone-content">
                <div className="upload-icon">📁</div>
                <p>Arrastre archivos CSV o XLSX aquí</p>
                <p className="upload-hint">o</p>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileInput}
                  className="file-input"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="file-input-label">
                  Seleccionar Archivo
                </label>
              </div>
            </div>
            <div className="file-format-info">
              <p><strong>Formato esperado:</strong></p>
              <p>Referencia, Nombre, Latitude, Longitude</p>
              <p>Ejemplo: REF-00000001, Bacheo 1, 18.4861, -69.9381</p>
            </div>
          </div>

          {/* Points Table with Pagination */}
          {groupPoints.length > 0 && (
            <div className="points-table-section">
              <h5>Puntos Cargados ({groupPoints.length})</h5>
              <div className="points-table-container">
                <table className="points-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Referencia</th>
                      <th>Nombre</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupPoints.slice(paginationStart, paginationStart + 5).map((point) => (
                      <tr key={point.id}>
                        <td>{point.sequence}</td>
                        <td>{point.referencia || 'N/A'}</td>
                        <td>{point.name}</td>
                        <td>
                          <button 
                            className="delete-btn"
                            onClick={() => {
                              setGroupPoints(prev => prev.filter(p => p.id !== point.id));
                              onDeletePoint(point.id);
                            }}
                            title="Eliminar punto"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Pagination Controls */}
                {groupPoints.length > 5 && (
                  <div className="pagination-controls">
                    <p>Mostrando 5 de {groupPoints.length} puntos</p>
                    <div className="pagination-slider">
                      <input
                        type="range"
                        min="0"
                        max={Math.max(0, groupPoints.length - 5)}
                        step="1"
                        className="pagination-slider-input"
                        onChange={(e) => {
                          const startIndex = parseInt(e.target.value);
                          setPaginationStart(startIndex);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Report Button */}
              <div className="report-section">
                <button 
                  className="report-btn"
                  onClick={generateReport}
                >
                  📊 Generar Reporte
                </button>
              </div>
              
              {/* Clear Points Button */}
              <div className="clear-points-section">
                <button 
                  className="clear-points-btn"
                  onClick={() => {
                    setGroupPoints([]);
                    // Clear all points from map
                    groupPoints.forEach(point => onDeletePoint(point.id));
                  }}
                >
                  🗑️ Borrar puntos
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeMenu === 'Manejar segmentos' && (
        <div className="manage-segments-section">
          <h4>Manejar Segmentos</h4>
          <h5 style={{marginTop: '15px', marginBottom: '10px', color: 'white'}}>Acciones</h5>
          <div className="manage-options">
            <button 
              className={`manage-btn ${selectedAction === 'actualizar' ? 'active-action' : ''}`}
              onClick={() => setSelectedAction('actualizar')}
            >
              Actualizar información
            </button>
            <button 
              className={`manage-btn ${selectedAction === 'ver' ? 'active-action' : ''}`}
              onClick={() => setSelectedAction('ver')}
            >
              Ver actividad
            </button>
          </div>
        </div>
      )}

      {selectedSegment && activeMenu !== 'Localización puntos' && activeMenu !== 'Localización grupal' && (
        <div className="segment-info">
          <h4>Información del segmento</h4>
          <div className="info-grid scrollable">
            <div className="info-item">
              <label>CÓDIGO DE LA VÍA:</label>
              <span>{selectedSegment.street_code || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>ID:</label>
              <span>{selectedSegment.id || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>NOMBRE:</label>
              <span>{selectedSegment.street_name || selectedSegment.name || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>LONGITUD:</label>
              <span>{selectedSegment.length ? `${selectedSegment.length.toFixed(2)}m` : 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>COORDENADAS INICIALES:</label>
              <span>
                {selectedSegment.coords && selectedSegment.coords.length > 0
                  ? `${selectedSegment.coords[0][1].toFixed(6)}, ${selectedSegment.coords[0][0].toFixed(6)}`
                  : 'N/A'
                }
              </span>
            </div>
            <div className="info-item">
              <label>COORDENADAS FINALES:</label>
              <span>
                {selectedSegment.coords && selectedSegment.coords.length > 0
                  ? `${selectedSegment.coords[selectedSegment.coords.length - 1][1].toFixed(6)}, ${selectedSegment.coords[selectedSegment.coords.length - 1][0].toFixed(6)}`
                  : 'N/A'
                }
              </span>
            </div>
            <div className="info-item">
              <label>CLASE DE VÍA:</label>
              <span>{selectedSegment.fclass || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>MUNICIPIO:</label>
              <span>{selectedSegment.municipality || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>GEOMETRÍA:</label>
              <span>{selectedSegment.geometry || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>PUNTOS:</label>
              <span>{selectedSegment.coords ? selectedSegment.coords.length : 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Clear search button outside segment info box */}
      {selectedSegment && activeMenu !== 'Localización puntos' && activeMenu !== 'Localización grupal' && (
        <div className="clear-search-section">
          <button 
            className="clear-search-btn"
            onClick={onClearSelection}
          >
            Borrar búsqueda
          </button>
        </div>
      )}

    </div>
  );
};

export default Sidebar;
