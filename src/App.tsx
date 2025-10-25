import React, { useState, useCallback, useMemo, useEffect } from 'react';
import './App.css';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
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

  // Calculate statistics
  const statistics = useMemo(() => calculateStatistics(segments), [segments]);

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
        />
        <div className="main-content">
          <MapComponent
            segments={segments}
            onSegmentClick={handleSegmentClick}
            loading={loading}
            onLoadSegments={handleLoadSegments}
          />
        </div>
      </div>
    </div>
  );
}

export default App;