import axios from "axios";

const request = axios.create({
    baseURL: 'http://localhost:8085',
    maxBodyLength: Infinity,
    maxContentLength: Infinity
});

request.defaults.headers.common["Access-Control-Allow-Origin"] = "*";

export { request }