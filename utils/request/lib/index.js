'use strict';

const axios = require('axios')

// 域名，暂时没有
const BASE_URL = process.env.IMOOC_CLI_BASE_URL ? process.env.IMOOC_CLI_BASE_URL : 'http://localhost:7001/'

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 5000
})

request.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    return Promise.reject(error)
  }
)

module.exports = request;