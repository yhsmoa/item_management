const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3002;

// CORS 설정
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// 로켓그로스 API 프록시 설정
app.use('/api/coupang', createProxyMiddleware({
  target: 'https://api-gateway.coupang.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/coupang': '/v2/providers/seller_api/apis/api/v1/marketplace', // 로켓그로스 API 경로로 변환
  },
  onProxyReq: (proxyReq, req, res) => {
    // Authorization 헤더가 있으면 전달
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    } else {
      console.error('❌ 로켓그로스 API - Authorization 헤더가 없습니다!');
    }
    
    // Content-Type 헤더 설정
    proxyReq.setHeader('Content-Type', 'application/json');
  },
  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.statusCode >= 400) {
      console.error(`❌ 로켓그로스 API 오류: ${proxyRes.statusCode} ${req.url}`);
    }
  },
  onError: (err, req, res) => {
    console.error(`❌ 로켓그로스 API 프록시 오류: ${err.message} - ${req.url}`);
    res.status(500).json({ error: '프록시 서버 오류: ' + err.message });
  }
}));

// 일반쿠팡 API 프록시 설정 (marketplace)
app.use('/api/marketplace', createProxyMiddleware({
  target: 'https://api-gateway.coupang.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/marketplace': '/v2/providers/seller_api/apis/api/v1/marketplace', // 일반쿠팡 API 경로로 변환
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 일반쿠팡 API 요청: ${req.method} ${req.url}`);
    console.log(`🎯 최종 프록시 URL: ${proxyReq.path}`);
    
    // Authorization 헤더가 있으면 전달
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
      console.log(`🔐 Authorization: ${req.headers.authorization.substring(0, 50)}...`);
    } else {
      console.error('❌ 일반쿠팡 API - Authorization 헤더가 없습니다!');
    }
    
    // Content-Type 헤더 설정
    proxyReq.setHeader('Content-Type', 'application/json');
  },
  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.statusCode >= 400) {
      console.error(`❌ 일반쿠팡 API 오류: ${proxyRes.statusCode} ${req.url}`);
    }
  },
  onError: (err, req, res) => {
    console.error('❌ 일반쿠팡 API 프록시 오류:', err.message);
    res.status(500).json({ error: '프록시 서버 오류: ' + err.message });
  }
}));

// 테스트 엔드포인트 추가
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'success',
    message: '프록시 서버 연결 테스트 성공!',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: '쿠팡 API CORS 프록시 서버가 실행 중입니다!',
    port: PORT,
    endpoints: {
      rocketGrowthApi: `http://localhost:${PORT}/api/coupang`,
      normalCoupangApi: `http://localhost:${PORT}/api/marketplace`,
      test: `http://localhost:${PORT}/api/test`
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 CORS 프록시 서버가 포트 ${PORT}에서 실행 중입니다!`);
  console.log(`📡 프록시 URL: http://localhost:${PORT}/api/coupang`);
  console.log(`🔗 테스트 URL: http://localhost:${PORT}`);
});

module.exports = app; 