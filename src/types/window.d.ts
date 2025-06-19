// 글로벌 타입 정의
declare global {
  interface Window {
    XLSX: any;
  }
}

// xlsx 모듈 타입 정의
declare module 'xlsx' {
  const XLSX: any;
  export = XLSX;
}

export {}; 