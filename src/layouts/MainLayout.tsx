import React, { useState } from 'react';
import styled from 'styled-components';
import TopMenuBar from '../components/TopMenuBar';
import LeftSideBar from '../components/LeftSideBar';

/**
 * MainLayout 컴포넌트 Props 타입 정의
 * - children: 메인 콘텐츠 영역에 렌더링할 컴포넌트들
 * - onGoogleSheetsImport: 구글 시트 가져오기 핸들러 (선택적)
 * - googleSheetsLoading: 구글 시트 로딩 상태 (선택적)
 */
interface MainLayoutProps {
  children: React.ReactNode;
  onGoogleSheetsImport?: () => void;
  googleSheetsLoading?: boolean;
}

/**
 * 메인 레이아웃 컴포넌트
 * - 로그인 후 모든 페이지에서 사용되는 기본 레이아웃
 * - 상단 메뉴바 + 왼쪽 사이드바 + 메인 콘텐츠 영역으로 구성
 * - 사이드바 토글 기능 포함
 */
const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  onGoogleSheetsImport,
  googleSheetsLoading = false
}) => {
  // 사이드바 표시/숨김 상태 관리
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  /**
   * 사이드바 토글 핸들러
   * - TopMenuBar의 햄버거 메뉴 클릭 시 호출
   */
  const toggleSidebar = () => {
    setIsSidebarVisible(prev => !prev);
  };

  return (
    <LayoutContainer>
      {/* 상단 메뉴바 - 고정 위치 */}
      <TopMenuBar
        onToggleSidebar={toggleSidebar}
        isSidebarVisible={isSidebarVisible}
        onGoogleSheetsImport={onGoogleSheetsImport}
        googleSheetsLoading={googleSheetsLoading}
      />
      
      {/* 메인 콘텐츠 영역 */}
      <MainContent>
        {/* 왼쪽 사이드바 */}
        <LeftSideBar isVisible={isSidebarVisible} />
        
        {/* 메인 콘텐츠 */}
        <ContentArea $sidebarVisible={isSidebarVisible}>
          {children}
        </ContentArea>
      </MainContent>
    </LayoutContainer>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 전체 레이아웃 컨테이너
 * - 전체 화면을 채우는 컨테이너
 * - 상단바 + 메인 콘텐츠 영역의 세로 배치
 */
const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;
`;

/**
 * 메인 콘텐츠 영역
 * - 상단바 아래 전체 영역
 * - 사이드바 + 콘텐츠의 가로 배치
 */
const MainContent = styled.div`
  display: flex;
  flex: 1;
  margin-top: 64px; /* 상단바 높이만큼 여백 */
  overflow: hidden;
`;

/**
 * 콘텐츠 영역
 * - 사이드바와 상단바를 제외한 메인 콘텐츠 영역
 * - 동적으로 변하는 레이아웃에 맞춰 조정
 * - 스크롤 시 상단바에 가려지지 않도록 개선된 설정
 */
const ContentArea = styled.div<{ $sidebarVisible: boolean }>`
  margin-left: ${props => props.$sidebarVisible ? '250px' : '0'};
  min-height: calc(100vh - 64px);
  background: #FAFAFA;
  transition: margin-left 0.3s ease-in-out;
  position: relative;
  padding: 0;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
  
  /* 스크롤 시 상단바 아래 콘텐츠가 가려지지 않도록 z-index 조정 */
  z-index: 1;
  
  /* 스크롤바 스타일링 */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #F3F4F6;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #D1D5DB;
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: #9CA3AF;
  }
  
  /* 사이드바 호버 확장에 대응하여 부드러운 트랜지션 */
  @media (hover: hover) {
    margin-left: ${props => props.$sidebarVisible ? '250px' : '0'};
    
    /* 사이드바 호버 시 여백 자동 조정을 위한 개선된 트랜지션 */
    transition: margin-left 0.3s ease-in-out, padding-left 0.3s ease-in-out;
  }
  
  /* 모바일 반응형 */
  @media (max-width: 768px) {
    margin-left: 0;
    padding: 0;
  }
`;

export default MainLayout; 