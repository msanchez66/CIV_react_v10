import React, { useState, useCallback, useMemo, useEffect } from 'react';
import './App.css';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import CumulativeChart from './components/CumulativeChart';
import { useSegments } from './hooks/useSegments';
import { searchSegments, calculateStatistics } from './utils/segmentUtils';
import { Segment } from './types/Segment';

function App() {
  const { segments, loading, error } = useSegments();
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeMenu, setActiveMenu] = useState<string>('Home');
  const [pointsList, setPointsList] = useState<Array<{id: number, name: string, lat: number, lng: number, sequence: number, referencia?: string}>>([]);
  const [nextSequence, setNextSequence] = useState<number>(1);
  const [groupPoints, setGroupPoints] = useState<Array<{id: number, name: string, lat: number, lng: number, sequence: number, referencia?: string}>>([]);
  const [paginationStart, setPaginationStart] = useState<number>(0);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [cumulativeData, setCumulativeData] = useState<any>(null);

  // Calculate statistics
  const statistics = useMemo(() => calculateStatistics(segments), [segments]);

  // Fetch cumulative distribution data
  useEffect(() => {
    fetch('/cumulative_distribution.json')
      .then(res => res.json())
      .then(data => setCumulativeData(data))
      .catch(err => console.error('Error loading cumulative data:', err));
  }, []);

  // Handle segment click
  const handleSegmentClick = useCallback((segment: Segment) => {
    setSelectedSegment(segment);
    console.log('Segment clicked:', segment);
    
    // Highlight segment and recenter map at zoom 18
    if ((window as any).highlightSegment) {
      console.log('Calling highlightSegment from segment click...');
      (window as any).highlightSegment(segment);
    } else {
      console.error('highlightSegment function not available');
    }
    if ((window as any).recenterMapToSegment) {
      console.log('Calling recenterMapToSegment from segment click...');
      (window as any).recenterMapToSegment(segment, 18);
    } else {
      console.error('recenterMapToSegment function not available');
    }
  }, []);

  // Handle dropdown selection
  const handleDropdownSelection = useCallback((segmentId: string) => {
    console.log('Dropdown selection triggered with segmentId:', segmentId);
    console.log('Available segments:', segments.length);
    
    const selected = segments.find(s => s.id === segmentId);
    console.log('Found selected segment:', selected);
    
    if (selected) {
      setSelectedSegment(selected);
      console.log('Segment selected from dropdown:', selected);
      
      // Use setTimeout to ensure state update completes before calling map functions
      setTimeout(() => {
        // Highlight segment and recenter map at zoom 18
        if ((window as any).highlightSegment) {
          console.log('Calling highlightSegment...');
          (window as any).highlightSegment(selected);
        } else {
          console.error('highlightSegment function not available');
        }
        
        if ((window as any).recenterMapToSegment) {
          console.log('Calling recenterMapToSegment...');
          (window as any).recenterMapToSegment(selected, 18);
        } else {
          console.error('recenterMapToSegment function not available');
        }
      }, 200); // Increased delay to ensure state update
    } else {
      console.error('Segment not found with id:', segmentId);
    }
  }, [segments]);

  // Helper function to normalize street names for comparison
  const normalizeStreetName = useCallback((name: string | undefined): string => {
    if (!name || name === 'N/A') return '';
    return name.trim().toLowerCase();
  }, []);

  // Helper function to check if two street names match
  const streetNamesMatch = useCallback((name1: string | undefined, name2: string | undefined): boolean => {
    const norm1 = normalizeStreetName(name1);
    const norm2 = normalizeStreetName(name2);
    
    // Both empty/null/N/A - they don't match (each unnamed segment is unique)
    if (!norm1 && !norm2) return false;
    
    // One empty, one not - they don't match
    if (!norm1 || !norm2) return false;
    
    // Both have names - exact match
    return norm1 === norm2;
  }, [normalizeStreetName]);

  // Handle adding a single point
  const handleAddPoint = useCallback((lat: number, lng: number, name?: string) => {
    const newPoint = {
      id: Date.now(),
      name: name || `Punto ${nextSequence}`,
      lat,
      lng,
      sequence: nextSequence
    };
    setPointsList(prev => [...prev, newPoint]);
    setNextSequence(prev => prev + 1);
    
    // Add marker to map (blue marker for individual points)
    if ((window as any).addMarkerToMapWithSequence) {
      (window as any).addMarkerToMapWithSequence(newPoint.lat, newPoint.lng, newPoint.name, newPoint.id, newPoint.sequence);
    }
  }, [nextSequence]);

  // Handle uploading multiple points (for Localización grupal)
  const handleUploadPoints = useCallback((points: Array<{lat: number, lng: number, name?: string, referencia?: string}>) => {
    const newPoints = points.map((point, index) => ({
      id: Date.now() + index,
      name: point.name || `Punto ${nextSequence + index}`,
      lat: point.lat,
      lng: point.lng,
      sequence: nextSequence + index,
      referencia: point.referencia || `REF-${(nextSequence + index).toString().padStart(8, '0')}`
    }));
    
    // Add to group points for "Localización grupal" only
    setGroupPoints(prev => [...prev, ...newPoints]);
    setNextSequence(prev => prev + points.length);
    
    // Add markers to map with sequence numbers
    newPoints.forEach(point => {
      if ((window as any).addMarkerToMapWithSequence) {
        (window as any).addMarkerToMapWithSequence(point.lat, point.lng, point.name, point.id, point.sequence);
      }
    });
  }, [nextSequence]);

  // Handle deleting a point
  const handleDeletePoint = useCallback((pointId: number) => {
    setPointsList(prev => prev.filter(point => point.id !== pointId));
    setGroupPoints(prev => prev.filter(point => point.id !== pointId));
    
    // Remove marker from map
    if ((window as any).removeMarkerFromMap) {
      (window as any).removeMarkerFromMap(pointId);
    }
  }, []);

  // Handle search by name
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setSelectedSegment(null);
      return;
    }

    // Find segments matching the search query
    const matchingSegments = searchSegments(segments, query);

    if (matchingSegments.length > 0) {
      // Select the first matching segment
      setSelectedSegment(matchingSegments[0]);
      
      // Highlight segment and recenter map at zoom 18
      if ((window as any).highlightSegment) {
        (window as any).highlightSegment(matchingSegments[0]);
      }
      if ((window as any).recenterMapToSegment) {
        (window as any).recenterMapToSegment(matchingSegments[0], 18);
      }
      
      console.log('Found matching segments:', matchingSegments);
    } else {
      setSelectedSegment(null);
    }
  }, [segments]);

  // Handle search by code
  const handleSearchByCode = useCallback((municipality: string, code: string) => {
    const fullCode = `${municipality}-${code.padStart(6, '0')}`;
    console.log('Searching by code:', fullCode);
    
    // Find segments matching the street code
    const matchingSegments = segments.filter(segment => {
      const segmentCode = segment.street_code || '';
      return segmentCode === fullCode || segmentCode.includes(fullCode);
    });

    if (matchingSegments.length > 0) {
      // Select the first matching segment
      setSelectedSegment(matchingSegments[0]);
      
      // Highlight segment and recenter map at zoom 18
      if ((window as any).highlightSegment) {
        (window as any).highlightSegment(matchingSegments[0]);
      }
      if ((window as any).recenterMapToSegment) {
        (window as any).recenterMapToSegment(matchingSegments[0], 18);
      }
      
      console.log('Found matching segments by code:', matchingSegments);
    } else {
      setSelectedSegment(null);
      alert(`No se encontró ningún segmento con el código: ${fullCode}`);
    }
  }, [segments]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedSegment(null);
    setSearchQuery('');
    
    // Unhighlight segment
    if ((window as any).unhighlightSegment) {
      (window as any).unhighlightSegment();
    }
  }, []);

  // Load segments manually
  const handleLoadSegments = useCallback(() => {
    console.log('Manual load segments triggered');
    // Call the global function exposed by MapComponent
    if ((window as any).loadSegmentsForCurrentView) {
      (window as any).loadSegmentsForCurrentView();
    }
  }, []);

  // Handle menu change and clear searches
  const handleMenuChange = useCallback((menu: string) => {
    setActiveMenu(menu);
    // Clear previous searches when switching menu items
    setSelectedSegment(null);
    setSearchQuery('');
    if (menu === 'Manejar segmentos') {
      setSelectedAction('actualizar'); // Set default action for "Manejar segmentos"
    } else {
      setSelectedAction('');
    }
    
    // Unhighlight any selected segment
    if ((window as any).unhighlightSegment) {
      (window as any).unhighlightSegment();
    }
  }, []);

  // Expose global functions for inter-component communication
  useEffect(() => {
    (window as any).clearAllPointsFromApp = () => {
      setPointsList([]);
      setNextSequence(1);
    };
  }, []);


  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading Application</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header Strip */}
      <div className="header-strip">
        <img src="/MOPC_logo.png" alt="MOPC Logo" className="header-logo left-logo" />
        <h1>Sistema de Codificación de Infraestructura Vial (CIV) - Santo Domingo</h1>
        <img src="/WBG_logo.jpg" alt="WBG Logo" className="header-logo right-logo" />
      </div>
      
      {/* Menu Strip */}
      <div className="menu-strip">
        <div 
          className={`menu-item ${activeMenu === 'Home' ? 'active' : ''}`}
          onClick={() => handleMenuChange('Home')}
        >
          Home
        </div>
        <div 
          className={`menu-item ${activeMenu === 'Search' ? 'active' : ''}`}
          onClick={() => handleMenuChange('Search')}
        >
          Buscar
        </div>
        <div 
          className={`menu-item ${activeMenu === 'Localización puntos' ? 'active' : ''}`}
          onClick={() => handleMenuChange('Localización puntos')}
        >
          Localización puntos
        </div>
        <div 
          className={`menu-item ${activeMenu === 'Localización grupal' ? 'active' : ''}`}
          onClick={() => handleMenuChange('Localización grupal')}
        >
          Localización grupal
        </div>
        <div 
          className={`menu-item ${activeMenu === 'Manejar segmentos' ? 'active' : ''}`}
          onClick={() => handleMenuChange('Manejar segmentos')}
        >
          Manejar segmentos
        </div>
      </div>

      <div className="main-layout">
        <Sidebar
          selectedSegment={selectedSegment}
          setSelectedSegment={setSelectedSegment}
          onSearch={handleSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onClearSelection={handleClearSelection}
          onLoadSegments={handleLoadSegments}
          statistics={statistics}
          activeMenu={activeMenu}
          onSearchByCode={handleSearchByCode}
          onAddPoint={handleAddPoint}
          onUploadPoints={handleUploadPoints}
          pointsList={pointsList}
          onDeletePoint={handleDeletePoint}
          groupPoints={groupPoints}
          setGroupPoints={setGroupPoints}
          paginationStart={paginationStart}
          setPaginationStart={setPaginationStart}
          selectedAction={selectedAction}
          setSelectedAction={setSelectedAction}
        />
        <div className={`main-content ${activeMenu === 'Manejar segmentos' ? 'split-layout' : ''}`}>
          {activeMenu === 'Manejar segmentos' ? (
            <>
              <div className="left-column-info">
                {selectedSegment ? (
                  <>
                    {/* Title with fancy blue line */}
                    <h4 className="segment-quadrant-title">Información del segmento</h4>
                    
                    {/* Street name and code in light grey box */}
                    <div className="street-info-box">
                      {/* Display street name or "Calle NN-YYYYYY" if no name */}
                      <div className="street-name-large">
                        {(() => {
                          const streetName = selectedSegment.street_name || selectedSegment.name;
                          if (streetName && streetName !== 'N/A' && streetName.trim() !== '') {
                            return streetName;
                          } else {
                            // Display "Calle NN-YYYYYY" where YYYYYY is the street code
                            const streetCode = selectedSegment.street_code || '';
                            const codeMatch = streetCode.match(/([A-Z]+)-(\d+)/);
                            if (codeMatch) {
                              return `Calle ${codeMatch[1]}-${codeMatch[2]}`;
                            }
                            return 'Calle NN-000000';
                          }
                        })()}
                      </div>
                      
                      {/* Street code dropdown */}
                      {(() => {
                        const streetName = selectedSegment.street_name || selectedSegment.name;
                        console.log('Current segment street name:', streetName);
                        
                        // Filter segments with the same street name (or no name if this one has no name)
                        const sameStreetSegments = segments.filter(s => {
                          const currentName = selectedSegment.street_name || selectedSegment.name;
                          const segmentName = s.street_name || s.name;
                          const matches = streetNamesMatch(currentName, segmentName);
                          console.log(`Comparing "${currentName}" with "${segmentName}": ${matches}`);
                          return matches;
                        });
                        
                        console.log(`Found ${sameStreetSegments.length} segments with street name "${streetName}"`);
                        console.log('Same street segments:', sameStreetSegments.map(s => ({ 
                          id: s.id, 
                          code: s.street_code, 
                          name: s.street_name || s.name 
                        })));
                        
                        return (
                          <div className="street-code-dropdown-container">
                            <div className="civ-label">CIV:</div>
                            {sameStreetSegments.length > 1 ? (
                              <select 
                                key={`dropdown-${selectedSegment.id}`}
                                className="street-code-dropdown"
                                value={selectedSegment.id}
                                onChange={(e) => {
                                  console.log('Dropdown onChange triggered with value:', e.target.value);
                                  handleDropdownSelection(e.target.value);
                                }}
                              >
                                {sameStreetSegments.map(seg => (
                                  <option key={seg.id} value={seg.id}>
                                    {seg.street_code || seg.id}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="street-code-display">
                                {selectedSegment.street_code || 'N/A'}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    
                    {/* Additional info box */}
                    <div className="segment-details-box">
                      <div className="detail-item">
                        <span className="detail-label">Longitud:</span>
                        <span className="detail-value">
                          {selectedSegment.length ? `${selectedSegment.length.toFixed(2)}m` : 'N/A'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Municipalidad:</span>
                        <span className="detail-value">
                          {selectedSegment.municipality || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="no-segment-placeholder">
                    <div className="placeholder-icon">📍</div>
                    <h3>No hay segmento seleccionado</h3>
                    <p>Por favor seleccione un segmento usando una de las siguientes opciones:</p>
                    <ul className="selection-instructions">
                      <li>🔍 <strong>Buscar por nombre</strong> en la barra lateral</li>
                      <li>🔢 <strong>Buscar por código</strong> (DNX-XXXXXX)</li>
                      <li>🗺️ <strong>Hacer clic en el mapa</strong> para seleccionar directamente</li>
                    </ul>
                  </div>
                )}
              </div>
              <div className="map-container">
                <MapComponent
                  segments={segments}
                  onSegmentClick={handleSegmentClick}
                  loading={loading}
                  onLoadSegments={handleLoadSegments}
                />
              </div>
              <div className="map-info-container">
                <h4>Información de la red</h4>
                <div className="network-info-content">
                  <div className="chart-container">
                    {cumulativeData && (
                      <CumulativeChart 
                        data={cumulativeData.cumulative_data} 
                        maxX={cumulativeData.max_length}
                      />
                    )}
                  </div>
                  <div className="network-stats">
                    <div className="network-stat-item">
                      <label>Longitud total de los segmentos:</label>
                      <span>10,714.2 km</span>
                    </div>
                    <div className="network-stat-item">
                      <label>No. segmentos:</label>
                      <span>{cumulativeData?.total_segments?.toLocaleString() || '124,476'}</span>
                    </div>
                    <div className="network-stat-item">
                      <label>Max Length:</label>
                      <span>18990.69m</span>
                    </div>
                    <div className="network-stat-item">
                      <label>Min Length (roads &gt; 10m):</label>
                      <span>10.00m</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <MapComponent
              segments={segments}
              onSegmentClick={handleSegmentClick}
              loading={loading}
              onLoadSegments={handleLoadSegments}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;