# 🚀 Railway 배포 환경변수 설정 가이드

## 📋 필수 환경변수 목록

Railway 프로젝트 설정 → Variables에서 다음 환경변수들을 추가하세요:

### 🔐 Supabase 설정
```
REACT_APP_SUPABASE_URL=https://mkcxpkblohioqboemmah.supabase.co
REACT_APP_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rY3hwa2Jsb2hpb3Fib2VtbWFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTExMTE2OSwiZXhwIjoyMDY0Njg3MTY5fQ.6MrqlrMqSHwuUpCp5xWJSRCqAeqW4TYwKW38o17Hb0o
```

### 🛒 쿠팡 API 설정
```
REACT_APP_COUPANG_ACCESS_KEY=6a9d9ee7-f252-4086-9a9c-306a38c70223
REACT_APP_COUPANG_SECRET_KEY=c21e858a7d60e2c895b1534edf8801729634f18e
REACT_APP_COUPANG_VENDOR_ID=A00312592
```

### 📊 Google Sheets API 설정
```
REACT_APP_GOOGLE_SHEETS_API_KEY=AIzaSyDTLkXb-kxoG2_uKrpHHATTrTJW1ldNzf8
REACT_APP_GOOGLE_OAUTH_CLIENT_ID=497107979859-hb5jkh4e017t0jup2sa792crvta2auuq.apps.googleusercontent.com
```

### 🌐 서버 URL 설정 (Railway용)
```
REACT_APP_PROXY_SERVER_URL=https://your-proxy-server.railway.app
```

## 🎯 Railway 설정 단계

### 1. Railway 프로젝트 생성
1. [Railway.app](https://railway.app) 로그인
2. "New Project" → "Deploy from GitHub repo"
3. 이 프로젝트 선택

### 2. 환경변수 설정
1. 프로젝트 대시보드에서 "Variables" 탭 클릭
2. 위의 모든 환경변수를 하나씩 추가
   - Name: 변수명 (예: REACT_APP_SUPABASE_URL)
   - Value: 실제 값 복사/붙여넣기

### 3. 빌드 설정 확인
```json
{
  "scripts": {
    "build": "react-scripts build",
    "start": "serve -s build"
  }
}
```

### 4. 프록시 서버 별도 배포 (필요시)
쿠팡 API CORS 문제 해결을 위해 `proxy-server.js`를 별도 Railway 프로젝트로 배포

## ⚠️ 보안 주의사항

1. **절대로 환경변수 값을 GitHub에 commit하지 마세요**
2. **이 파일(RAILWAY_ENV_SETUP.md)도 .gitignore에 추가하거나 배포 후 삭제하세요**
3. **프로덕션 배포 후 API 키들을 재발급하는 것을 권장합니다**

## 🔄 배포 후 확인사항

1. Railway 배포 로그에서 빌드 성공 확인
2. 배포된 사이트에서 Supabase 데이터 로드 확인
3. 쿠팡 API 연동 기능 테스트
4. Google Sheets 연동 기능 테스트 