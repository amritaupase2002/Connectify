import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

export default function JoinRoom({ user, setRooms }) {
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const createRoom = async () => {
    if (!roomName.trim()) {
      toast.error('Room name cannot be empty');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data } = await axios.post(
        'https://connectify-delta-two.vercel.app/api/rooms/create',
        { name: roomName, type: 'video' },
        { 
          headers: { 
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setRooms(prev => [...prev, data]);
      setRoomName('');
      toast.success(`Room "${data.name}" created!`);
    } catch (err) {
      console.error('Room creation error:', err);
      toast.error(err.response?.data?.error || 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col space-y-2">
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="New Room Name"
          className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isLoading && createRoom()}
          disabled={isLoading}
        />
        <button
          onClick={createRoom}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg text-white font-semibold ${
            isLoading ? 'bg-gray-500' : 'bg-teal-600 hover:bg-teal-500'
          }`}
        >
          {isLoading ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );
}