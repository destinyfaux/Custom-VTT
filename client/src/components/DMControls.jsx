// client/src/components/DMControls.jsx
import { useEffect, useState } from 'react';
import { socket } from '../socket';
import { SERVER_URL } from '../config';

export default function DMControls() {
  const [maps, setMaps] = useState([]);
  const [selectedMap, setSelectedMap] = useState('');

  useEffect(() => {
    // Ensure the URL matches your server
    fetch(`${SERVER_URL}/api/maps`)
      .then(res => res.json())
      .then(data => {
          console.log("Maps loaded:", data); // Check console to see if folders arrive
          setMaps(data);
          if (data.length > 0) setSelectedMap(data[0]); 
      })
      .catch(err => console.error("Error fetching maps:", err));
  },[]);

  const loadMap = () => {
    if (selectedMap) socket.emit('change_map', selectedMap);
  };

  return (
    <div className="flex items-center gap-1 bg-bgPanel border border-borderDark p-1 rounded shadow-lg h-9">
        {maps.length === 0 ? (
        <span className="text-[9px] text-red-400 italic px-2">No maps found</span>
        ) : (
            <>
              <select 
            className="bg-bgCard text-textLight px-2 py-0.5 rounded border border-borderDark text-[10px] focus:outline-none focus:border-accentGold outline-none min-w-[100px] h-full cursor-pointer appearance-none text-center"
                value={selectedMap}
                onChange={(e) => setSelectedMap(e.target.value)}
              >
                {maps.map(mapName => (
                  <option key={mapName} value={mapName}>{mapName}</option>
                ))}
              </select>
          
              <button 
            className="bg-accentGold text-black font-extrabold px-3 rounded text-[10px] hover:bg-yellow-500 transition-colors h-full whitespace-nowrap shadow-sm active:translate-y-px"
                onClick={loadMap}
              >
                LOAD MAP
              </button>
            </>
        )}
    </div>
  );
}