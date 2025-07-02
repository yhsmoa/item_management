import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

/**
 * TopMenuBar 컴포넌트 Props 타입 정의
 * - onToggleSidebar: 사이드바 토글 함수
 * - isSidebarVisible: 사이드바 표시 상태
 */
interface TopMenuBarProps {
  onToggleSidebar: () => void;
  isSidebarVisible: boolean;
}

/**
 * 상단 메뉴바 컴포넌트
 * - 애플리케이션 상단에 고정되는 네비게이션 바
 * - 햄버거 메뉴, 로고, 검색, 알림, 사용자 메뉴 포함
 * - 사이드바 토글 기능 제공
 */
const TopMenuBar: React.FC<TopMenuBarProps> = ({ onToggleSidebar, isSidebarVisible }) => {
  // 현재 로그인한 사용자 정보 가져오기
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  // 사용자 드롭다운 메뉴 표시 상태
  const [showUserMenu, setShowUserMenu] = useState(false);

  /**
   * 로그아웃 핸들러
   * - 사용자 세션 정보 삭제 후 로그인 페이지로 이동
   */
  const handleLogout = () => {
    console.log('🚪 로그아웃 처리 중...');
    
    // 드롭다운 메뉴 닫기
    setShowUserMenu(false);
    
    // 로컬스토리지에서 사용자 정보 삭제
    localStorage.removeItem('currentUser');
    
    console.log('✅ 사용자 정보 삭제 완료');
    console.log('🔄 로그인 페이지로 이동 중...');
    
    // 로그인 페이지로 리다이렉트
    window.location.href = '/login';
  };

  /**
   * 사용자 메뉴 토글 핸들러
   */
  const toggleUserMenu = () => {
    setShowUserMenu(prev => !prev);
  };

  /**
   * 개인정보 수정 페이지로 이동
   */
  const handleUserInfo = () => {
    // 개인정보 수정 페이지로 라우팅
    window.location.href = '/profile';
    setShowUserMenu(false);
  };

  /**
   * 외부 클릭 시 드롭다운 메뉴 닫기
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const userSection = target.closest('[data-user-section]');
      
      if (showUserMenu && !userSection) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      // 약간의 지연을 두어 클릭 이벤트가 제대로 처리되도록 함
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showUserMenu]);

  return (
    <TopBarContainer>
      {/* 왼쪽 영역 - 햄버거 메뉴 + 로고 */}
      <LeftSection>
        {/* 햄버거 메뉴 버튼 - 사이드바 토글 */}
        <HamburgerButton 
          onClick={onToggleSidebar}
          $isActive={isSidebarVisible}
          title="메뉴 토글"
        >
          <HamburgerLine />
          <HamburgerLine />
          <HamburgerLine />
        </HamburgerButton>
        
        {/* 서비스 로고 */}
        <Logo onClick={() => window.location.href = '/dashboard'}>
          <LogoText>
            아이템 매니지먼트
          </LogoText>
        </Logo>
      </LeftSection>

      {/* 중앙 영역 - 검색바 (추후 확장) */}
      <CenterSection>
        {/* 향후 검색 기능 추가 예정 */}
      </CenterSection>

      {/* 오른쪽 영역 - 언어선택, 알림, 사용자 메뉴 */}
      <RightSection>
        {/* 언어 선택 */}
        <LanguageButton>
          <LanguageIcon>🌐</LanguageIcon>
          <span>한국어</span>
          <DropdownIcon>▼</DropdownIcon>
        </LanguageButton>

        {/* 알림 버튼 */}
        <NotificationButton title="알림">
          <NotificationIcon>🔔</NotificationIcon>
          <NotificationBadge>3</NotificationBadge>
        </NotificationButton>

        {/* 사용자 정보 및 메뉴 */}
        <UserSection data-user-section>
          <UserInfo>
            <UserName 
              onClick={(e) => {
                e.stopPropagation();
                toggleUserMenu();
              }}
            >
              {currentUser.name || '사용자'} 님
            </UserName>
          </UserInfo>
          
          {/* 사용자 드롭다운 메뉴 */}
          {showUserMenu && (
            <UserDropdownMenu onClick={(e) => e.stopPropagation()}>
              <DropdownItem onClick={(e) => {
                e.stopPropagation();
                handleUserInfo();
              }}>
                👤 개인정보 수정
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}>
                🚪 로그아웃
              </DropdownItem>
            </UserDropdownMenu>
          )}
        </UserSection>
      </RightSection>
    </TopBarContainer>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 상단바 전체 컨테이너
 * - 화면 상단에 고정되는 네비게이션 바
 * - 흰색 배경에 그림자 효과
 * - 좌우 패딩과 정렬 설정
 * - 스크롤 시에도 항상 최상위 유지
 */
const TopBarContainer = styled.div`
  width: 100%;
  height: 64px;
  background: white;
  border-bottom: 1px solid #E5E7EB;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1100; /* 사이드바보다 높은 z-index로 설정 */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 100vw;
  box-sizing: border-box;
  
  /* 백드롭 블러 효과 추가 */
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
`;

/**
 * 왼쪽 섹션 - 햄버거 메뉴와 로고
 * - 가로 배치 및 적절한 간격
 * - 축소 방지로 안정적인 레이아웃 유지
 */
const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
`;

/**
 * 햄버거 메뉴 버튼
 * - 3개의 가로선으로 구성
 * - 클릭 시 사이드바 토글
 * - 호버 효과 및 부드러운 애니메이션
 */
const HamburgerButton = styled.button<{ $isActive: boolean }>`
  width: 40px;
  height: 40px;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: #F3F4F6;
  }
  
  &:active {
    background: #E5E7EB;
  }
`;

/**
 * 햄버거 메뉴의 가로선
 * - 3개의 선이 햄버거 모양 구성
 */
const HamburgerLine = styled.div`
  width: 20px;
  height: 2px;
  background: #374151;
  border-radius: 1px;
  transition: all 0.2s ease;
`;

/**
 * 로고 컨테이너
 * - 서비스 브랜드명 표시
 * - 클릭 시 홈으로 이동
 */
const Logo = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: opacity 0.2s ease;
  
  &:hover {
    opacity: 0.8;
  }
`;

/**
 * 로고 텍스트 스타일
 * - 아이템 매니지먼트 브랜드명
 */
const LogoText = styled.h1`
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin: 0;
  color: #1F2937;
`;

/**
 * 중앙 섹션 - 검색바 등 확장 영역
 * - 향후 기능 추가를 위한 예약 공간
 */
const CenterSection = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
`;

/**
 * 오른쪽 섹션 - 사용자 관련 메뉴들
 * - 언어선택, 알림, 사용자 정보 배치
 * - 최소 너비 보장으로 잘림 방지
 */
const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 300px;
  flex-shrink: 0;
  justify-content: flex-end;
`;

/**
 * 언어 선택 버튼
 * - 현재 언어 표시 및 드롭다운 메뉴
 */
const LanguageButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #9CA3AF;
    background: #F9FAFB;
  }
`;

/**
 * 언어 아이콘 (지구본)
 */
const LanguageIcon = styled.span`
  font-size: 14px;
`;

/**
 * 드롭다운 화살표 아이콘
 */
const DropdownIcon = styled.span`
  font-size: 10px;
  color: #6B7280;
`;

/**
 * 알림 버튼
 * - 알림 아이콘과 배지 포함
 * - 상대적 위치로 배지 배치
 */
const NotificationButton = styled.button`
  position: relative;
  width: 40px;
  height: 40px;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: #F3F4F6;
  }
`;

/**
 * 알림 아이콘 (벨)
 */
const NotificationIcon = styled.span`
  font-size: 18px;
`;

/**
 * 알림 배지 - 읽지 않은 알림 수 표시
 * - 빨간색 원형 배지
 * - 알림 아이콘 우상단에 위치
 */
const NotificationBadge = styled.span`
  position: absolute;
  top: 8px;
  right: 8px;
  background: #EF4444;
  color: white;
  font-size: 10px;
  font-weight: 600;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
`;

/**
 * 사용자 섹션 - 사용자 정보와 메뉴
 * - 사용자명, 역할, 아바타, 드롭다운 메뉴 포함
 */
const UserSection = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
`;

/**
 * 사용자 정보 컨테이너
 * - 사용자명과 역할을 세로로 배치
 */
const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
`;

/**
 * 사용자명 스타일
 * - 굵은 글씨로 강조
 * - 클릭 가능한 커서
 */
const UserName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #1F2937;
  cursor: pointer;
  
  &:hover {
    color: #4F46E5;
  }
`;

/**
 * 사용자 역할 표시
 * - 작은 글씨로 역할 정보 표시
 */
const UserRole = styled.span`
  font-size: 12px;
  color: #6B7280;
`;

/**
 * 사용자 아바타
 * - 원형 아바타에 이니셜 표시
 * - 클릭 시 드롭다운 메뉴 토글
 */
const UserAvatar = styled.div`
  width: 32px;
  height: 32px;
  background: #4F46E5;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #3B37F3;
    transform: scale(1.05);
  }
`;

/**
 * 사용자 드롭다운 메뉴
 * - 판매자 정보, 로그아웃 메뉴 포함
 * - 아바타 클릭 시 표시
 * - 최상위 레이어에 표시
 */
const UserDropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  min-width: 160px;
  z-index: 1200; /* TopBar보다 높은 z-index */
  
  /* 백드롭 블러 효과 */
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
`;

/**
 * 드롭다운 메뉴 아이템
 * - 각각의 메뉴 항목
 */
const DropdownItem = styled.button`
  width: 100%;
  padding: 12px 16px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: background 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background: #F3F4F6;
  }
  
  &:first-child {
    border-radius: 8px 8px 0 0;
  }
  
  &:last-child {
    border-radius: 0 0 8px 8px;
  }
`;

/**
 * 드롭다운 메뉴 구분선
 * - 메뉴 항목들 사이의 시각적 구분
 */
const DropdownDivider = styled.div`
  height: 1px;
  background: #E5E7EB;
  margin: 4px 0;
`;

export default TopMenuBar; 