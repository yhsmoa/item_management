import React, { useState } from 'react';
import styled from 'styled-components';
import TopMenuBar from '../components/TopMenuBar';
import LeftSideBar from '../components/LeftSideBar';

/**
 * MainLayout 컴포넌트 Props 타입 정의
 * - children: 메인 콘텐츠 영역에 렌더링할 컴포넌트들
 */
interface MainLayoutProps {
  children: React.ReactNode;
}

/**
 * 메인 레이아웃 컴포넌트
 * - 로그인 후 모든 페이지에서 사용되는 기본 레이아웃
 * - 상단 메뉴바 + 왼쪽 사이드바 + 메인 콘텐츠 영역으로 구성
 * - 사이드바 토글 기능 포함
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
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
      />
      
      {/* 메인 콘텐츠 영역 */}
      <MainContent>
        {/* 왼쪽 사이드바 */}
        <LeftSideBar isVisible={isSidebarVisible} />
        
        {/* 메인 콘텐츠 */}
        <ContentArea $isSidebarVisible={isSidebarVisible}>
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
 * - 사이드바 오른쪽에 위치하는 메인 콘텐츠
 * - 사이드바 상태에 따라 좌측 마진 조정
 * - 스크롤 가능
 */
const ContentArea = styled.div<{ $isSidebarVisible: boolean }>`
  flex: 1;
  margin-left: ${({ $isSidebarVisible }) => $isSidebarVisible ? '250px' : '0'};
  padding: 0;
  background: #F9FAFB;
  overflow-y: auto;
  transition: margin-left 0.3s ease;
  
  /* 반응형 대응 */
  @media (max-width: 768px) {
    margin-left: 0;
    padding: 0;
  }
`;

export default MainLayout; 