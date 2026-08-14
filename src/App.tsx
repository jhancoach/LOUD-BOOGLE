import { useState, useEffect } from 'react';
import Home from './views/Home';
import Room from './views/Room';
import OfflineRoom from './views/OfflineRoom';

export default function App() {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isTVMode, setIsTVMode] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [offlineSettings, setOfflineSettings] = useState({ gridSize: 4, duration: 180, minWordLength: 3 });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const tvParam = params.get('tv');
    if (roomParam) {
      setCurrentRoomId(roomParam);
      setIsTVMode(tvParam === 'true');
    }
  }, []);

  if (currentRoomId) {
    return <Room roomId={currentRoomId} isTV={isTVMode} onLeave={() => setCurrentRoomId(null)} />;
  }
  
  if (isOffline) {
    return <OfflineRoom onLeave={() => setIsOffline(false)} duration={offlineSettings.duration} gridSize={offlineSettings.gridSize} minWordLength={offlineSettings.minWordLength} />;
  }

  return <Home onJoinRoom={(id) => { setCurrentRoomId(id); setIsTVMode(false); }} onStartOffline={(settings) => { setOfflineSettings(settings || { gridSize: 4, duration: 180, minWordLength: 3 }); setIsOffline(true); }} />;
}


