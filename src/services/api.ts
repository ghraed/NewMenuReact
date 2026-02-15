import axios from 'axios';

const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';
const API_URL = isLocalhost 
    // ? 'http://127.0.0.1:8000/api'
    ? 'https://fran-utile-unmorosely.ngrok-free.dev/api'
    : 'https://192.168.10.203/api'; 

console.log('API_URL:', API_URL); // Check this in mobile browser console

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;