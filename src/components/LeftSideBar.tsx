import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

/**
 * LeftSideBar 컴포넌트 Props 타입 정의
 * - isVisible: 사이드바 표시/숨김 상태
 */
interface LeftSideBarProps {
  isVisible: boolean;
}

/**
 * 사이드바 메뉴 아이템 타입 정의
 * - id: 메뉴 고유 식별자
 * - title: 메뉴 제목
 * - icon: 메뉴 아이콘
 * - path: 라우팅 경로
 * - children: 하위 메뉴 (optional)
 */
interface MenuItem {
  id: string;
  title: string;
  icon: string;
  path: string;
  children?: MenuItem[];
}

/**
 * 왼쪽 사이드바 컴포넌트
 * - 판매자 관리 메뉴들을 계층적으로 표시
 * - 토글 가능한 사이드바
 * - 현재 선택된 메뉴 하이라이트
 * - 서브메뉴 확장/축소 기능
 */
const LeftSideBar: React.FC<LeftSideBarProps> = ({ isVisible }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 현재 선택된 메뉴 상태 관리
  const [selectedMenu, setSelectedMenu] = useState('');
  
  // 확장된 메뉴들 상태 관리 (서브메뉴가 있는 경우)
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  // 현재 페이지에 따른 메뉴 활성화 설정
  useEffect(() => {
    const currentPath = location.pathname;
    
    // 현재 경로에 따라 활성 메뉴와 확장된 메뉴 설정
    if (currentPath.includes('/products')) {
      setSelectedMenu('product-list');
      setExpandedMenus(['products']);
    } else if (currentPath.includes('/chinaorder')) {
      setSelectedMenu('china-order-list');
      setExpandedMenus(['orders']);
    } else if (currentPath.includes('/dashboard')) {
      setSelectedMenu('dashboard');
      setExpandedMenus([]);
    } else if (currentPath.includes('/analytics')) {
      setSelectedMenu('analytics');
      setExpandedMenus([]);
         } else if (currentPath.includes('/marketing')) {
       setSelectedMenu('marketing');
       setExpandedMenus(['marketing']);
     } else if (currentPath.includes('/stocks/scan')) {
       setSelectedMenu('stock-scan');
       setExpandedMenus(['stocks']);
     } else if (currentPath.includes('/stocks')) {
       setSelectedMenu('stock-list');
       setExpandedMenus(['stocks']);
     } else if (currentPath.includes('/finance')) {
      setSelectedMenu('finance');
      setExpandedMenus([]);
    } else if (currentPath.includes('/settings')) {
      setSelectedMenu('settings');
      setExpandedMenus(['settings']);
    }
  }, [location.pathname]);

  /**
   * 사이드바 메뉴 구조 정의
   * - 이미지의 메뉴 구조를 참고하여 구성
   */
  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      title: '대시보드',
      icon: '📊',
      path: '/dashboard'
    },
    {
      id: 'products',
      title: '상품관리',
      icon: '📦',
      path: '/products',
      children: [
        { id: 'product-list', title: '상품 목록', icon: '📋', path: '/products/list' },
        { id: 'product-add', title: '상품 등록', icon: '➕', path: '/products/add' },
        { id: 'product-views', title: '쿠팡 조회수 관리', icon: '👁️', path: '/products/views' }
      ]
    },
    {
      id: 'orders',
      title: '주문관리',
      icon: '🛒',
      path: '/orders',
      children: [
        { id: 'china-order-list', title: '주문 목록', icon: '📄', path: '/chinaorder/list' },
        { id: 'order-delivery', title: '요청 목록', icon: '🚚', path: '/orders/order-cart' },
        { id: 'order-return', title: '반품/교환', icon: '↩️', path: '/orders/return' }
      ]
    },
    {
      id: 'stocks',
      title: '재고관리',
      icon: '📦',
      path: '/stocks',
      children: [
        { id: 'stock-list', title: '재고 목록', icon: '📋', path: '/stocks/management' },
        { id: 'stock-scan', title: '재고 관리', icon: '📷', path: '/stocks/scan' }
      ]
    },
    {
      id: 'marketing',
      title: '서비스',
      icon: '📢',
      path: '/marketing',
      children: [
        { id: 'promotion', title: '로켓그로스 입고', icon: '🎯', path: '/marketing/promotion' },
        { id: 'coupon', title: '쿠폰 관리', icon: '🎫', path: '/marketing/coupon' }
      ]
    },
    {
      id: 'analytics',
      title: '비즈니스 인사이트',
      icon: '📈',
      path: '/analytics'
    },
    {
      id: 'finance',
      title: '정산',
      icon: '💰',
      path: '/finance'
    },
    {
      id: 'settings',
      title: '설정',
      icon: '⚙️',
      path: '/settings',
      children: [
        { id: 'store-info', title: '스토어 정보', icon: '🏪', path: '/settings/store' },
        { id: 'notification', title: '알림 설정', icon: '🔔', path: '/settings/notification' }
      ]
    }
  ];

  /**
   * 메뉴 클릭 핸들러
   * - 메뉴 선택 상태 업데이트
   * - 서브메뉴가 있는 경우 확장/축소 토글
   */
  const handleMenuClick = (menuId: string, hasChildren: boolean) => {
    setSelectedMenu(menuId);
    
    if (hasChildren) {
      setExpandedMenus(prev => 
        prev.includes(menuId) 
          ? prev.filter(id => id !== menuId)
          : [...prev, menuId]
      );
    }
  };

  /**
   * 서브메뉴 클릭 핸들러
   * - 서브메뉴 선택 시 상위 메뉴도 확장 상태 유지
   * - 실제 페이지로 이동
   */
  const handleSubMenuClick = (menuId: string, parentId: string, path: string) => {
    setSelectedMenu(menuId);
    if (!expandedMenus.includes(parentId)) {
      setExpandedMenus(prev => [...prev, parentId]);
    }
    // 현재 페이지와 같아도 항상 이동
    navigate(path);
  };

  /**
   * 메인 메뉴 클릭 핸들러 (서브메뉴가 없는 경우)
   */
  const handleMainMenuClick = (menuId: string, path: string) => {
    setSelectedMenu(menuId);
    setExpandedMenus([]);
    // 현재 페이지와 같아도 항상 이동
    navigate(path);
  };

  return (
    <SidebarContainer $isVisible={isVisible}>
      <SidebarContent>
        {/* 사이드바 헤더 */}
        <SidebarHeader>
          {/* 헤더 제목 제거 */}
        </SidebarHeader>

        {/* 메뉴 리스트 */}
        <MenuList>
          {menuItems.map((item) => (
            <MenuItemContainer key={item.id}>
              {/* 메인 메뉴 */}
              <MenuButton
                onClick={() => item.children ? handleMenuClick(item.id, true) : handleMainMenuClick(item.id, item.path)}
                $isSelected={selectedMenu === item.id || !!(item.children && item.children.some(child => child.id === selectedMenu))}
                $hasChildren={!!item.children}
              >
                <MenuIcon>{item.icon}</MenuIcon>
                <MenuTitle>{item.title}</MenuTitle>
                {item.children && (
                  <ExpandIcon $isExpanded={expandedMenus.includes(item.id)}>
                    ▼
                  </ExpandIcon>
                )}
              </MenuButton>

              {/* 서브메뉴 (있는 경우) */}
              {item.children && expandedMenus.includes(item.id) && (
                <SubMenuList>
                  {item.children.map((subItem) => (
                    <SubMenuButton
                      key={subItem.id}
                      onClick={() => handleSubMenuClick(subItem.id, item.id, subItem.path)}
                      $isSelected={selectedMenu === subItem.id}
                    >
                      <SubMenuIcon>{subItem.icon}</SubMenuIcon>
                      <SubMenuTitle>{subItem.title}</SubMenuTitle>
                    </SubMenuButton>
                  ))}
                </SubMenuList>
              )}
            </MenuItemContainer>
          ))}
        </MenuList>

        {/* 사이드바 하단 정보 */}
        <SidebarFooter>
          <FooterInfo>
            <InfoTitle>고객센터</InfoTitle>
            <InfoSubtitle>1588-1234</InfoSubtitle>
          </FooterInfo>
        </SidebarFooter>
      </SidebarContent>
    </SidebarContainer>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 사이드바 전체 컨테이너
 * - 고정 위치의 사이드바
 * - 토글에 따른 표시/숨김 애니메이션
 * - 상단바 아래 위치
 */
const SidebarContainer = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 64px;
  left: 0;
  width: 250px;
  height: calc(100vh - 64px);
  background: white;
  border-right: 1px solid #E5E7EB;
  transform: translateX(${props => props.$isVisible ? '0' : '-100%'});
  transition: transform 0.3s ease-in-out;
  z-index: 900;
  overflow: hidden;
`;

/**
 * 사이드바 내용 컨테이너
 * - 헤더, 메뉴, 푸터를 세로로 배치
 * - 스크롤 가능한 영역
 */
const SidebarContent = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

/**
 * 사이드바 헤더
 * - 빈 헤더 영역
 */
const SidebarHeader = styled.div`
  padding: 8px 16px;
`;

/**
 * 헤더 타이틀
 * - 사이드바 상단의 제목
 */
const HeaderTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: #1F2937;
  margin: 0;
`;

/**
 * 메뉴 리스트 컨테이너
 * - 스크롤 가능한 메뉴 영역
 * - 메인 콘텐츠 영역
 */
const MenuList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  
  /* 스크롤바 숨기기 */
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #D1D5DB;
    border-radius: 2px;
  }
`;

/**
 * 메뉴 아이템 컨테이너
 * - 메인 메뉴와 서브메뉴를 감싸는 컨테이너
 */
const MenuItemContainer = styled.div`
  margin-bottom: 4px;
`;

/**
 * 메인 메뉴 버튼
 * - 클릭 가능한 메뉴 항목
 * - 선택 상태에 따른 스타일 변경
 * - 호버 효과 포함
 */
const MenuButton = styled.button<{ $isSelected: boolean; $hasChildren: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: ${props => props.$isSelected ? '#EEF2FF' : 'transparent'};
  border: none;
  border-left: ${props => props.$isSelected ? '3px solid #4F46E5' : '3px solid transparent'};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$isSelected ? '#EEF2FF' : '#F9FAFB'};
  }
`;

/**
 * 메뉴 아이콘
 * - 각 메뉴의 대표 아이콘
 */
const MenuIcon = styled.span`
  font-size: 16px;
  width: 20px;
  display: flex;
  justify-content: center;
`;

/**
 * 메뉴 타이틀
 * - 메뉴명 텍스트
 * - 선택 상태에 따른 색상 변경
 */
const MenuTitle = styled.span`
  flex: 1;
  font-size: 16px;
  font-weight: 500;
  color: #374151;
  text-align: left;
`;

/**
 * 확장/축소 아이콘
 * - 서브메뉴가 있는 메뉴의 확장 표시
 * - 회전 애니메이션
 */
const ExpandIcon = styled.span<{ $isExpanded: boolean }>`
  font-size: 10px;
  color: #9CA3AF;
  transform: rotate(${props => props.$isExpanded ? '180deg' : '0deg'});
  transition: transform 0.2s ease;
`;

/**
 * 서브메뉴 리스트
 * - 하위 메뉴들을 감싸는 컨테이너
 * - 왼쪽 들여쓰기 적용
 */
const SubMenuList = styled.div`
  background: #F9FAFB;
  border-left: 2px solid #E5E7EB;
  margin-left: 16px;
`;

/**
 * 서브메뉴 버튼
 * - 하위 메뉴 항목
 * - 메인 메뉴보다 작은 크기와 들여쓰기
 */
const SubMenuButton = styled.button<{ $isSelected: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px 8px 20px;
  background: ${props => props.$isSelected ? '#EEF2FF' : 'transparent'};
  border: none;
  border-left: ${props => props.$isSelected ? '2px solid #4F46E5' : '2px solid transparent'};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$isSelected ? '#EEF2FF' : '#F3F4F6'};
  }
`;

/**
 * 서브메뉴 아이콘
 * - 하위 메뉴의 작은 아이콘
 */
const SubMenuIcon = styled.span`
  font-size: 12px;
  width: 16px;
  display: flex;
  justify-content: center;
`;

/**
 * 서브메뉴 타이틀
 * - 하위 메뉴명 텍스트
 */
const SubMenuTitle = styled.span`
  flex: 1;
  font-size: 14px;
  font-weight: 400;
  color: #6B7280;
  text-align: left;
`;

/**
 * 사이드바 하단 영역
 * - 고객센터 정보 등 부가 정보 표시
 */
const SidebarFooter = styled.div`
  padding: 16px;
  border-top: 1px solid #F3F4F6;
  background: #F9FAFB;
`;

/**
 * 하단 정보 컨테이너
 * - 고객센터 정보 등 표시
 */
const FooterInfo = styled.div`
  text-align: center;
`;

/**
 * 정보 타이틀 (고객센터)
 */
const InfoTitle = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: #6B7280;
  margin-bottom: 4px;
`;

/**
 * 정보 부제목 (전화번호)
 */
const InfoSubtitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #4F46E5;
`;

export default LeftSideBar; 