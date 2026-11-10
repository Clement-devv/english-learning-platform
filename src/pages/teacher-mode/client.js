import axios from 'axios';
import { deviceLoginHeaders } from '../../utils/deviceKey';
export const modeBase = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/teacher-mode`;
const client = axios.create({ baseURL: modeBase });
client.interceptors.request.use(async config => {
  const token = sessionStorage.getItem('teacherToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.url === '/login') Object.assign(config.headers, await deviceLoginHeaders());
  return config;
});
export default client;
