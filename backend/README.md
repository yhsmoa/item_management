# 🔐 아이템 관리 백엔드 서버

React → AWS Lightsail 백엔드 → 암호화 → Supabase 구조로 보안을 강화한 백엔드 API 서버입니다.

## 🏗️ 아키텍처

```
[사용자] → [React 앱] → [Express.js 백엔드] → [AES 암호화] → [Supabase]
          (포트 3000)      (포트 3001)         (암호화된 데이터)
```

## 🚀 AWS Lightsail 배포 방법

### 1. 백엔드 폴더를 GitHub에 푸시
```bash
# 현재 프로젝트 루트에서
git add backend/
git commit -m "🔐 백엔드 서버 추가: AES 암호화 기능"
git push origin main
```

### 2. AWS Lightsail에서 백엔드 설정
```bash
# SSH로 Lightsail 접속 후
cd /home/ubuntu/item_management
git pull origin main

# 백엔드 의존성 설치
cd backend
npm install

# 환경변수 설정
cp .env.example .env
nano .env
```

### 3. 환경변수 설정 (.env)
```bash
PORT=3001
SUPABASE_URL=https://mkcxpkblohioqboemmah.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ENCRYPTION_KEY=your-32-byte-random-encryption-key-here-123456789012
JWT_SECRET=your-jwt-secret-key-random-string
NODE_ENV=production
FRONTEND_URL=http://13.125.220.142:3000
```

### 4. PM2로 백엔드 서버 실행
```bash
# PM2 설치 (글로벌)
sudo npm install -g pm2

# 백엔드 서버 시작
pm2 start server.js --name "backend-api"

# PM2 프로세스 확인
pm2 list

# PM2 로그 확인
pm2 logs backend-api
```

### 5. 프론트엔드 환경변수 수정
React 앱에서 백엔드 URL 설정:
```bash
# 프론트엔드 .env 파일에 추가
REACT_APP_BACKEND_URL=http://13.125.220.142:3001
```

## 🔧 주요 기능

### API 엔드포인트

#### 1. 헬스 체크
```
GET /health
```

#### 2. 사용자 API 정보 저장 (암호화)
```
POST /api/user-api-info
Body: {
  user_id: string,
  coupang_name: string,
  coupang_code: string,
  coupang_access_key: string,
  coupang_secret_key: string,
  googlesheet_id?: string,
  googlesheet_name?: string
}
```

#### 3. 사용자 API 정보 조회 (복호화)
```
GET /api/user-api-info/:userId
```

#### 4. 암호화 테스트
```
POST /api/test-encryption
Body: { text: string }
```

## 🔒 보안 기능

### AES-256-CBC 암호화
- 민감한 데이터(API 키, 시크릿 등)를 AES-256-CBC로 암호화
- 각 암호화마다 랜덤 IV(Initialization Vector) 사용
- 암호화 키는 서버 환경변수로 안전하게 관리

### 보안 미들웨어
- **helmet**: 보안 헤더 설정
- **cors**: CORS 정책 설정
- **express.json()**: JSON 파싱 (크기 제한)

### 데이터베이스 보안
- Supabase RLS(Row Level Security) 적용
- 암호화된 데이터만 저장
- 서비스 역할 키로 서버 인증

## 🗄️ Supabase 테이블 구조

새로운 암호화 테이블 생성이 필요합니다:

```sql
-- 암호화된 사용자 API 정보 테이블
CREATE TABLE users_api_encrypted (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  coupang_name TEXT,           -- 암호화된 데이터
  coupang_code TEXT,           -- 암호화된 데이터
  coupang_access_key TEXT,     -- 암호화된 데이터
  coupang_secret_key TEXT,     -- 암호화된 데이터
  googlesheet_id TEXT,         -- 암호화된 데이터
  googlesheet_name TEXT,       -- 암호화된 데이터
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- RLS 활성화
ALTER TABLE users_api_encrypted ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 데이터만 조회 가능
CREATE POLICY "Users can view own encrypted api data" ON users_api_encrypted
  FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 자신의 데이터만 삽입 가능
CREATE POLICY "Users can insert own encrypted api data" ON users_api_encrypted
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 데이터만 업데이트 가능
CREATE POLICY "Users can update own encrypted api data" ON users_api_encrypted
  FOR UPDATE USING (auth.uid() = user_id);
```

## 🧪 테스트 방법

### 1. 백엔드 헬스 체크
```bash
curl http://13.125.220.142:3001/health
```

### 2. 암호화 테스트
```bash
curl -X POST http://13.125.220.142:3001/api/test-encryption \
  -H "Content-Type: application/json" \
  -d '{"text":"테스트 문자열"}'
```

### 3. React 앱에서 백엔드 연동 테스트
- 개인정보 입력 페이지에서 데이터 저장
- 브라우저 개발자 도구에서 네트워크 탭 확인
- Supabase에서 암호화된 데이터 확인

## 📝 로그 모니터링

```bash
# PM2 로그 실시간 확인
pm2 logs backend-api --lines 50

# PM2 프로세스 상태 확인
pm2 monit

# PM2 재시작
pm2 restart backend-api
```

## ⚠️ 주의사항

1. **ENCRYPTION_KEY**: 32바이트 랜덤 문자열로 설정 (분실 시 기존 데이터 복호화 불가)
2. **포트 관리**: 3000(React), 3001(백엔드) 포트가 열려있는지 확인
3. **환경변수**: 프로덕션에서는 민감한 정보를 안전하게 관리
4. **SSL**: 프로덕션에서는 HTTPS 사용 권장

## 🔧 문제 해결

### 백엔드 서버 연결 안됨
```bash
# 포트 확인
sudo netstat -tlnp | grep :3001

# PM2 프로세스 확인
pm2 list

# 로그 확인
pm2 logs backend-api
```

### 암호화/복호화 오류
- ENCRYPTION_KEY가 올바르게 설정되었는지 확인
- 환경변수가 정확히 로드되었는지 확인
- 서버 재시작 후 테스트 