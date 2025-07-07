import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { toast } from 'react-toastify';

const socket = io('http://localhost:3001');

export default function ChatRoom({ user, room }) {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [meetingLink, setMeetingLink] = useState('');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnections = useRef({});

  // Generate meeting link on component mount
  useEffect(() => {
    setMeetingLink(`${window.location.origin}/join/${room.id}`);
  }, [room.id]);

  // Debugging useEffect for streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      console.log('Local video tracks:', localStream.getTracks());
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      console.log('Remote video tracks:', remoteStream.getTracks());
    }
  }, [localStream, remoteStream]);

  useEffect(() => {
    socket.emit('join_room', room.id, user.id);

    socket.on('load_messages', (loadedMessages) => {
      setMessages(loadedMessages);
    });

    socket.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // WebRTC signaling
    socket.on('offer', async (id, description) => {
      console.log('Received offer from:', id);
      await handleOffer(id, description);
    });

    socket.on('answer', (id, description) => {
      console.log('Received answer from:', id);
      peerConnections.current[id]?.setRemoteDescription(description);
    });

    socket.on('candidate', (id, candidate) => {
      console.log('Received ICE candidate from:', id);
      const pc = peerConnections.current[id];
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(e => console.error('ICE candidate error:', e));
      }
    });

    socket.on('user_joined', (userId) => {
      console.log('User joined:', userId);
      if (user.id !== userId) {
        createPeerConnection(userId);
      }
    });

    return () => {
      socket.off('load_messages');
      socket.off('receive_message');
      socket.off('offer');
      socket.off('answer');
      socket.off('candidate');
      socket.off('user_joined');
      endCall();
    };
  }, [room.id, user.id]);

  const createPeerConnection = async (userId) => {
    console.log('Creating peer connection with:', userId);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        // Add TURN servers here if needed
      ],
    });

    // Add local stream if available
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
        console.log('Added local track:', track.kind);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to:', userId);
        socket.emit('candidate', userId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      const stream = event.streams[0];
      setRemoteStream(stream);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    // Only create offer if we're the initiator
    if (localStream) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('Sending offer to:', userId);
        socket.emit('offer', userId, pc.localDescription);
      } catch (err) {
        console.error('Offer creation error:', err);
      }
    }

    peerConnections.current[userId] = pc;
    return pc;
  };

  const handleOffer = async (userId, description) => {
    console.log('Handling offer from:', userId);
    const pc = await createPeerConnection(userId);
    await pc.setRemoteDescription(description);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log('Sending answer to:', userId);
    socket.emit('answer', userId, answer);
  };

  const startCall = async () => {
    try {
      console.log('Requesting media devices...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });

      console.log('Obtained media stream');
      setLocalStream(stream);
      setIsInCall(true);
      socket.emit('start_call', room.id);

    } catch (err) {
      console.error('Media access error:', err);
      toast.error(`Couldn't access camera/mic: ${err.message}`);
    }
  };

  const endCall = () => {
    console.log('Ending call...');
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setIsInCall(false);
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
  };

  const copyMeetingLink = () => {
    navigator.clipboard.writeText(meetingLink)
      .then(() => toast.success('Meeting link copied!'))
      .catch(() => toast.error('Failed to copy link'));
  };

  const sendMessage = async () => {
    if (currentMessage.trim()) {
      socket.emit('send_message', {
        roomId: room.id,
        userId: user.id,
        content: currentMessage,
      });
      setCurrentMessage('');
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto bg-gray-800 rounded-xl shadow-lg p-4">
      {/* Room header with controls */}
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
        <h2 className="text-xl font-bold text-teal-400">{room.name}</h2>
        <div className="flex space-x-2">
          <button
            onClick={copyMeetingLink}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
          >
            Copy Meeting Link
          </button>
          <button
            onClick={isInCall ? endCall : startCall}
            className={`px-3 py-1 rounded-lg font-semibold ${
              isInCall 
                ? 'bg-red-600 hover:bg-red-500 text-white' 
                : 'bg-teal-600 hover:bg-teal-500 text-white'
            }`}
          >
            {isInCall ? 'End Call' : 'Start Call'}
          </button>
        </div>
      </div>

      {/* Video call section */}
      {isInCall ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-center p-1">
              You
            </div>
          </div>
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-center p-1">
              Participant
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-700 rounded-lg p-8 text-center mb-4">
          <p className="text-gray-300">Click "Start Call" to begin video meeting</p>
          <p className="text-sm text-gray-400 mt-2">
            Share this link to invite others: {meetingLink}
          </p>
        </div>
      )}

      {/* Messages section */}
      <div className="flex-1 overflow-y-auto mb-4 max-h-64 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg ${
              msg.username === user.username
                ? 'bg-teal-600 ml-auto max-w-xs'
                : 'bg-gray-700 mr-auto max-w-xs'
            }`}
          >
            <p className="font-semibold text-teal-200">{msg.username}</p>
            <p className="text-white">{msg.content}</p>
            <p className="text-xs text-gray-300 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>

      {/* Message input */}
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="Type a message..."
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg"
        >
          Send
        </button>
      </div>
    </div>
  );
}