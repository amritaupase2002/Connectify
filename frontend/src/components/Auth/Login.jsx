import { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function Login({ setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post('http://localhost:3001/api/auth/login', { username, password });
      setUser({ username, token: data.token });
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="p-8 bg-gray-800 rounded-xl shadow-lg w-full max-w-sm">
        <h1 className="text-2xl font-bold text-teal-400 text-center mb-4">Login</h1>
        {error && <p className="text-red-500 text-center">{error}</p>}
        <div className="flex flex-col space-y-4">
          <input
            type="text"
            placeholder="Username"
            className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            onClick={handleLogin}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-semibold"
          >
            Login
          </button>
          <p className="text-center">
            Don't have an account? <Link to="/register" className="text-teal-400">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}