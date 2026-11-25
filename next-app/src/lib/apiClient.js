import axios from 'axios';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});
apiClient.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('hostelswap_next_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});
apiClient.interceptors.response.use((response) => response, (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
        const isAuthRoute = error.config?.url?.includes('/auth/login');
        if (!isAuthRoute) {
            localStorage.removeItem('hostelswap_next_token');
        }
    }
    return Promise.reject(error);
});
export function getApiErrorMessage(err, fallback = 'Something went wrong') {
    if (axios.isAxiosError(err)) {
        if (err.response?.data?.error?.message) {
            return err.response.data.error.message;
        }
        if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
            return 'Backend server is not running on port 4000. Please start it with npm run dev:backend or npm run dev:all.';
        }
        if (err.response?.status === 503) {
            return err.response?.data?.error?.message || 'Backend service is currently unavailable. Ensure the backend is running on port 4000.';
        }
        if (err.response?.status === 500) {
            return 'Internal Server Error (Backend service may be stopped or database unreachable).';
        }
        return err.message || fallback;
    }
    if (err instanceof Error)
        return err.message;
    return fallback;
}
