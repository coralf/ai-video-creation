import axios from "axios";
const request = axios.create({
    baseURL: 'http://localhost:8085',
    maxBodyLength: Infinity,
    maxContentLength: Infinity
});

request.interceptors.response.use((response) => {
    return response
}, (error: any) => {
    const detail = error.response.data?.detail;
    return Promise.reject({ message: detail, status: error.response.status });
});

request.defaults.headers.common["Access-Control-Allow-Origin"] = "*";

export { request }