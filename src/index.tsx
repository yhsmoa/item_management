import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './routes/AppRouter';
import './index.css';

/**
 * 애플리케이션 엔트리 포인트
 * - React 애플리케이션이 시작되는 최상위 파일
 * - DOM에 React 컴포넌트를 마운트하는 역할
 * - 전역 스타일(index.css) 임포트
 */

// HTML의 'root' 요소를 찾아서 React 루트 생성
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// React 애플리케이션 렌더링 시작
root.render(
  // StrictMode 비활성화 - useEffect 중복 실행 방지
  /* <React.StrictMode> */
    /* 애플리케이션의 메인 라우터 컴포넌트 렌더링 */
    <AppRouter />
  /* </React.StrictMode> */
); 