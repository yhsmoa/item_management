# 🚀 배포 가이드

## ⚠️ 중요: 미래의 AI/개발자에게

이 프로젝트는 **로컬 개발 환경**과 **Lightsail 운영 환경**을 분리해서 운영합니다.

**절대 헷갈리지 마세요:**
- `.env.local` = 로컬 개발용 (localhost)
- `.env.production` = Lightsail 배포용 (13.125.220.142)

---

## 📋 환경 구성

### 로컬 개발 환경
```
프론트엔드: http://localhost:3000
백엔드: http://localhost:3001
프록시: http://localhost:3002
```

**사용 파일:** `.env.local`

### Lightsail 운영 환경
```
Public IP: 13.125.220.142
프론트엔드: http://13.125.220.142:3000
백엔드: http://13.125.220.142:3001
프록시: http://13.125.220.142:3002
```

**사용 파일:** `.env.production`

---

## 🔧 로컬 개발 시작하기

### 1. 백엔드 실행 (터미널 1)
```bash
cd backend
npm install  # 처음 한 번만
npm start    # 또는 npm run dev
```

### 2. 프론트엔드 실행 (터미널 2)
```bash
npm install  # 처음 한 번만
npm start
```

### 3. 브라우저에서 확인
```
http://localhost:3000
```

**✅ 로컬 개발 시에는 `.env.local`이 자동으로 사용됩니다.**

---

## 🚀 Lightsail 배포하기

### 현재 배포 방식 (수동)

#### 1. 코드 변경 후 Git Push
```bash
git add .
git commit -m "your message"
git push origin master
```

#### 2. Lightsail SSH 접속
```bash
ssh -i item_management-key.pem ubuntu@13.125.220.142
```

#### 3. 코드 업데이트
```bash
cd /home/ubuntu/item_management
git pull origin master
```

#### 4-A. 프론트엔드만 수정한 경우
```bash
npm install           # 새 패키지가 있으면
npm run build         # 프로덕션 빌드
pm2 restart frontend  # 프론트엔드 재시작
```

#### 4-B. 백엔드도 수정한 경우
```bash
npm run build         # 프론트엔드 빌드

cd backend
npm install           # 새 패키지가 있으면
pm2 restart all       # 모든 서비스 재시작
```

---

## 🔍 환경변수 파일 설명

### `.env.local` (로컬 개발용)
- **목적**: 로컬 컴퓨터에서 개발할 때 사용
- **특징**: 백엔드도 로컬(localhost)을 가리킴
- **위치**: Git에 커밋되지 않음 (.gitignore)

```bash
REACT_APP_BACKEND_URL=http://localhost:3001
REACT_APP_PROXY_SERVER_URL=http://localhost:3002
```

### `.env.production` (Lightsail 배포용)
- **목적**: Lightsail 서버에 배포할 때 사용
- **특징**: Lightsail IP(13.125.220.142)를 가리킴
- **위치**: Git에 커밋되지 않음 (.gitignore)

```bash
REACT_APP_BACKEND_URL=http://13.125.220.142:3001
REACT_APP_PROXY_SERVER_URL=http://13.125.220.142:3002
```

### `backend/.env` (백엔드 설정)
- **목적**: 백엔드 서버 설정
- **특징**: 로컬/서버 모두 동일하게 사용
- **위치**: Git에 커밋되지 않음 (.gitignore)

---

## 🎯 빌드 프로세스

### React 앱 빌드 시 환경변수 적용 원리

#### 로컬에서 개발 (npm start)
```bash
npm start
→ .env.local 파일 자동 로드
→ REACT_APP_BACKEND_URL=http://localhost:3001
```

#### Lightsail에서 빌드 (npm run build)
```bash
npm run build
→ .env.production 파일 자동 로드
→ REACT_APP_BACKEND_URL=http://13.125.220.142:3001
→ build/ 폴더에 환경변수가 포함된 정적 파일 생성
```

**중요:** `npm run build` 실행 시점에 환경변수가 코드에 삽입됩니다!

---

## ⚠️ 주의사항

### AI/개발자가 헷갈리기 쉬운 부분

#### ❌ 하지 말아야 할 것
1. **백엔드 코드를 수정하면서 localhost로 바꾸기**
   - `.env.production`의 URL을 localhost로 변경하면 안 됩니다!
   - 백엔드는 Lightsail에서 실행되고 있습니다.

2. **환경변수 파일 삭제하기**
   - `.env.local`과 `.env.production` 모두 필요합니다.

3. **환경변수 파일을 Git에 커밋하기**
   - 보안상 문제가 있습니다.
   - `.gitignore`에 이미 추가되어 있습니다.

#### ✅ 올바른 방법
1. **로컬 개발 시**
   - 백엔드도 로컬에서 실행 (`cd backend && npm start`)
   - `.env.local` 사용 (자동)

2. **Lightsail 배포 시**
   - `npm run build` 실행
   - `.env.production` 사용 (자동)
   - 빌드된 파일을 서버에 배포

---

## 🛠️ 트러블슈팅

### API 연결 안 됨
```bash
# 로컬 개발 시
→ 백엔드가 실행 중인지 확인: http://localhost:3001
→ .env.local 파일 확인

# Lightsail 배포 시
→ Lightsail 백엔드 확인: pm2 status
→ .env.production 파일 확인
→ 빌드를 다시 했는지 확인 (npm run build)
```

### 환경변수가 적용 안 됨
```bash
# React는 빌드 시점에 환경변수를 코드에 삽입합니다
# 환경변수를 변경했다면 반드시 재빌드!

# 로컬
npm start를 재시작

# Lightsail
npm run build를 다시 실행
```

---

## 📚 PM2 명령어 참고

```bash
pm2 list              # 실행 중인 프로세스 확인
pm2 restart all       # 모든 프로세스 재시작
pm2 restart backend   # 백엔드만 재시작
pm2 restart frontend  # 프론트엔드만 재시작
pm2 logs              # 로그 확인
pm2 logs backend      # 백엔드 로그만
pm2 logs frontend     # 프론트엔드 로그만
```

---

## 🔐 보안 주의사항

### Git에 커밋되면 안 되는 파일들
- `.env.local`
- `.env.production`
- `backend/.env`
- `*.pem` (SSH 키)

이미 `.gitignore`에 추가되어 있습니다.

---

## 📞 문제 발생 시

1. **이 문서를 먼저 읽기**
2. **환경변수 파일 확인**
3. **PM2 로그 확인** (`pm2 logs`)
4. **백엔드 실행 상태 확인** (`pm2 status`)

---

## 🎓 요약

```
로컬 개발:
  - .env.local 사용
  - localhost:3001 (백엔드도 로컬 실행)
  - npm start

Lightsail 배포:
  - .env.production 사용
  - 13.125.220.142:3001
  - npm run build
  - git pull 후 pm2 restart
```

**핵심: 두 환경은 환경변수 파일만 다르고, 코드는 동일합니다!**
