const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase 클라이언트 설정
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 미들웨어 설정
app.use(helmet()); // 보안 헤더
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://13.125.220.142:3000',
    process.env.FRONTEND_URL
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 암호화/복호화 함수
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16; // AES의 IV는 16바이트
const ALGORITHM = 'aes-256-cbc'; // 암호화 알고리즘

/**
 * AES 암호화 (최신 보안 표준)
 * @param {string} text - 암호화할 텍스트
 * @returns {string} - 암호화된 데이터 (IV + 암호화된 텍스트)
 */
function encrypt(text) {
  if (!text) return null;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // IV와 암호화된 데이터를 합쳐서 반환
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('❌ 암호화 에러:', error);
    return null;
  }
}

/**
 * AES 복호화 (최신 보안 표준)
 * @param {string} encryptedData - 암호화된 데이터
 * @returns {string} - 복호화된 텍스트
 */
function decrypt(encryptedData) {
  if (!encryptedData) return null;
  
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      console.error('❌ 잘못된 암호화 데이터 형식');
      return null;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ 복호화 에러:', error);
    return null;
  }
}

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    server: 'item-management-backend'
  });
});

/**
 * 사용자 API 정보 저장 (암호화)
 * POST /api/user-api-info
 */
app.post('/api/user-api-info', async (req, res) => {
  try {
    console.log('🔐 API 정보 암호화 저장 요청 받음');
    
    const {
      user_id,
      coupang_name,
      coupang_code,
      coupang_access_key,
      coupang_secret_key,
      googlesheet_id,
      googlesheet_name
    } = req.body;

    // 필수 필드 검증
    if (!user_id || !coupang_name || !coupang_code || !coupang_access_key || !coupang_secret_key) {
      return res.status(400).json({
        success: false,
        error: '필수 필드가 누락되었습니다.'
      });
    }

    // 민감한 데이터 암호화
    const encryptedData = {
      user_id, // 사용자 ID는 암호화하지 않음 (검색용)
      coupang_name: encrypt(coupang_name),
      coupang_code: encrypt(coupang_code),
      coupang_access_key: encrypt(coupang_access_key),
      coupang_secret_key: encrypt(coupang_secret_key),
      googlesheet_id: googlesheet_id ? encrypt(googlesheet_id) : null,
      googlesheet_name: googlesheet_name ? encrypt(googlesheet_name) : null
    };

    console.log('🔐 데이터 암호화 완료');

    // Supabase 기존 users_api 테이블에 암호화된 데이터 저장
    const { data, error } = await supabase
      .from('users_api')
      .upsert([encryptedData], {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('❌ Supabase 저장 에러:', error);
      return res.status(500).json({
        success: false,
        error: `데이터 저장 실패: ${error.message}`
      });
    }

    console.log('✅ 암호화된 데이터 저장 완료 (users_api 테이블 사용)');

    res.json({
      success: true,
      message: 'API 정보가 안전하게 암호화되어 저장되었습니다.',
      data: data
    });

  } catch (error) {
    console.error('❌ API 정보 저장 에러:', error);
    res.status(500).json({
      success: false,
      error: `서버 오류: ${error.message}`
    });
  }
});

/**
 * 사용자 API 정보 조회 (복호화)
 * GET /api/user-api-info/:userId
 */
app.get('/api/user-api-info/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`🔍 사용자 ${userId} API 정보 조회 요청`);

    // Supabase 기존 users_api 테이블에서 데이터 조회
    const { data, error } = await supabase
      .from('users_api')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 데이터가 없는 경우
        return res.json({
          success: true,
          data: null,
          message: '저장된 API 정보가 없습니다.'
        });
      }
      
      console.error('❌ Supabase 조회 에러:', error);
      return res.status(500).json({
        success: false,
        error: `데이터 조회 실패: ${error.message}`
      });
    }

    // 암호화된 데이터인지 확인 (콜론이 포함되어 있으면 암호화된 데이터)
    const isEncrypted = data.coupang_name && data.coupang_name.includes(':');
    
    let responseData;
    
    if (isEncrypted) {
      // 암호화된 데이터 복호화
      responseData = {
        user_id: data.user_id,
        coupang_name: decrypt(data.coupang_name),
        coupang_code: decrypt(data.coupang_code),
        coupang_access_key: decrypt(data.coupang_access_key),
        coupang_secret_key: decrypt(data.coupang_secret_key),
        googlesheet_id: data.googlesheet_id ? decrypt(data.googlesheet_id) : null,
        googlesheet_name: data.googlesheet_name ? decrypt(data.googlesheet_name) : null
      };
      console.log('🔓 암호화된 데이터 복호화 완료');
    } else {
      // 평문 데이터 그대로 반환
      responseData = data;
      console.log('📄 평문 데이터 반환');
    }

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ API 정보 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: `서버 오류: ${error.message}`
    });
  }
});

/**
 * 암호화 테스트 엔드포인트
 * POST /api/test-encryption
 */
app.post('/api/test-encryption', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '테스트할 텍스트를 입력해주세요.'
      });
    }

    const encrypted = encrypt(text);
    const decrypted = decrypt(encrypted);

    res.json({
      success: true,
      original: text,
      encrypted: encrypted,
      decrypted: decrypted,
      isMatch: text === decrypted
    });

  } catch (error) {
    console.error('❌ 암호화 테스트 에러:', error);
    res.status(500).json({
      success: false,
      error: `테스트 실패: ${error.message}`
    });
  }
});

// 조회수 관리 라우터
const viewsRouter = require('./routes/views');
app.use('/api/views', viewsRouter);

// 404 에러 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API 엔드포인트를 찾을 수 없습니다.'
  });
});

// 글로벌 에러 핸들러
app.use((error, req, res, next) => {
  console.error('❌ 서버 에러:', error);
  res.status(500).json({
    success: false,
    error: '내부 서버 오류가 발생했습니다.'
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 백엔드 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📡 헬스 체크: http://localhost:${PORT}/health`);
  console.log(`🔐 API 엔드포인트: http://localhost:${PORT}/api/`);
}); 