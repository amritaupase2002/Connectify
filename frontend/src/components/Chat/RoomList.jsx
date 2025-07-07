export default function RoomList({ rooms, setSelectedRoom }) {
  return (
    <div className="space-y-2">
      {rooms.map((room) => (
        <div
          key={room.id}
          onClick={() => setSelectedRoom(room)}
          className="p-2 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600"
        >
          <p className="text-teal-300 font-semibold">{room.name}</p>
        </div>
      ))}
    </div>
  );
}