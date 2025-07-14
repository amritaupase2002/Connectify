import { useState, useEffect } from 'react';
import axios from 'axios';
import RoomList from '../components/Chat/RoomList';
import ChatRoom from '../components/Chat/ChatRoom';
import JoinRoom from '../components/JoinRoom';

export default function Home({ user, setUser }) {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await axios.get('https://connectify-delta-two.vercel.app/api/rooms/list', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setRooms(data);
    };
    fetchRooms();
  }, [user.token]);

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <div className="md:w-1/4 p-4 bg-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-teal-400">Chat Rooms</h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded-lg text-white"
          >
            Logout
          </button>
        </div>
        <RoomList rooms={rooms} setSelectedRoom={setSelectedRoom} />
        <JoinRoom user={user} setRooms={setRooms} />
      </div>
      <div className="md:w-3/4 p-4">
        {selectedRoom ? (
          <ChatRoom user={user} room={selectedRoom} />
        ) : (
          <p className="text-center text-gray-400">Select a room to start chatting</p>
        )}
      </div>
    </div>
  );
}