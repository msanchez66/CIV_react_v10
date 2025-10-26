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
      (window as any).highlightSegment(segment);
    }
    if ((window as any).recenterMapToSegment) {
      (window as any).recenterMapToSegment(segment, 18);
    }
  }, []);

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
    setSelectedAction('');
    
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
          onSearch={handleSearch}
          searchQuery={searchQuery}
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
        <div className={`main-content ${activeMenu === 'Manejar segmentos' && selectedAction ? 'split-layout' : ''}`}>
          {activeMenu === 'Manejar segmentos' && selectedAction ? (
            <>
              <div className="left-column-info">
                {selectedSegment ? (
                  <>
                    {/* Title outside the box with blue line above */}
                    <h4 className="segment-info-title-outside">Información del segmento</h4>
                    
                    {/* Street Name - Centered and Large */}
                    <div className="street-name-header">
                      {(() => {
                        const streetName = selectedSegment.street_name || selectedSegment.name;
                        const displayName = (streetName && streetName !== 'N/A') 
                          ? streetName 
                          : (() => {
                              // If N/A, use street code format
                              const streetCode = selectedSegment.street_code || '';
                              const codeMatch = streetCode.match(/([A-Z]+)-(\d+)/);
                              return codeMatch ? `${codeMatch[1]}-${codeMatch[2]}` : 'Calle NN-000000';
                            })();
                        return displayName;
                      })()}
                    </div>

                    {/* Segment Info Box */}
                    <div className="segment-info-quadrant">
                      {/* Segment Code with Dropdown for same street segments */}
                      {(() => {
                        // Get current street name (normalized)
                        const currentStreetName = selectedSegment.street_name || selectedSegment.name;
                        
                        // Filter segments with same street name and DNX code
                        const sameStreetSegments = segments.filter(s => {
                          const sName = s.street_name || s.name;
                          const sCode = s.street_code || '';
                          // Match both same street name AND DNX code
                          return sName === currentStreetName && sCode.match(/^DNX-/);
                        });
                        
                        return (
                          <div className="segment-code-container">
                            <span className="code-prefix">CÓDIGO:</span>
                            {sameStreetSegments.length > 1 ? (
                              <select 
                                className="segment-code-dropdown"
                                value={selectedSegment.id}
                                onChange={(e) => {
                                  const selected = segments.find(s => s.id === e.target.value);
                                  if (selected) setSelectedSegment(selected);
                                }}
                              >
                                {sameStreetSegments.map(seg => (
                                  <option key={seg.id} value={seg.id}>
                                    {seg.street_code || seg.id}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="code-display">{selectedSegment.street_code || selectedSegment.id || 'N/A'}</span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Additional Info */}
                      <div className="segment-field">
                        <span className="field-label">LONGITUD:</span>
                        <span className="field-value">{selectedSegment.length ? `${selectedSegment.length.toFixed(2)}m` : 'N/A'}</span>
                      </div>
                      <div className="segment-field">
                        <span className="field-label">CLASE DE VÍA:</span>
                        <span className="field-value">{selectedSegment.fclass || 'N/A'}</span>
                      </div>
                      <div className="segment-field">
                        <span className="field-label">MUNICIPIO:</span>
                        <span className="field-value">{selectedSegment.municipality || 'N/A'}</span>
                      </div>
                    </div>
                  </>
                ) : null}
                
                {/* Back button moved to bottom */}
                <button 
                  className="back-button"
                  onClick={() => setSelectedAction('')}
                >
                  ← Volver
                </button>
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