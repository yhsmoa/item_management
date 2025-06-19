import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

/**
 * Topbar 컴포넌트의 Props 타입 정의
 * - showMenu: 메뉴 텍스트 표시 여부 (회원가입 페이지에서 사용)
 */
interface TopbarProps {
  showMenu?: boolean;
}

/**
 * 상단 네비게이션 바 컴포넌트
 * - 모든 페이지 상단에 고정되는 네비게이션
 * - 로고, 메뉴명, 로그인 버튼으로 구성
 * - 회원가입 페이지에서는 "판매자 회원가입" 메뉴명 표시
 */
const Topbar: React.FC<TopbarProps> = ({ showMenu = false }) => {
  return (
    <Container>
      {/* 좌측 영역 - 로고 및 메뉴명 */}
      <Left>
        {/* 서비스 로고 */}
        <Logo>아이템 관리</Logo>
        
        {/* 조건부 렌더링: showMenu가 true일 때만 메뉴명 표시 */}
        {showMenu && (
          <MenuText>판매자 회원가입</MenuText>
        )}
      </Left>
      
      {/* 우측 영역 - 로그인 버튼 */}
      <Right>
        {/* React Router Link를 사용한 로그인 페이지 이동 버튼 */}
        <LoginButton to="/login">로그인</LoginButton>
      </Right>
    </Container>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 네비게이션 바 전체 컨테이너
 * - 화면 상단에 고정 (position: fixed)
 * - 전체 너비에 고정 높이 64px
 * - 흰색 배경에 하단 테두리
 * - 좌우 요소 간격 조정을 위한 flexbox 사용
 * - 다른 요소들 위에 표시하기 위한 z-index 설정
 * - 로그인 버튼 잘림 방지를 위한 충분한 우측 패딩 확보
 */
const Container = styled.div`
  width: 100%;
  height: 64px;
  background: white;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 320px;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  box-sizing: border-box;
  min-width: 100vw;
  
  @media (min-width: 768px) {
    padding: 0 40px 0 320px;
  }
`;

/**
 * 좌측 영역 컨테이너 - 로고와 메뉴명을 감싸는 영역
 * - 가로 배치 및 반응형 간격 설정
 */
const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  
  @media (min-width: 768px) {
    gap: 32px;
  }
`;

/**
 * 로고 스타일 - "아이템 관리" 텍스트
 * - 굵은 폰트와 브랜드 컬러 적용
 * - 반응형 폰트 크기 조정
 */
const Logo = styled.h1`
  font-size: 18px;
  font-weight: 700;
  color: #2D3748;
  letter-spacing: -0.5px;
  white-space: nowrap;
  
  @media (min-width: 768px) {
    font-size: 20px;
  }
`;

/**
 * 메뉴 텍스트 스타일 - 현재 페이지명 표시
 * - 로고보다 작은 크기와 연한 색상
 * - 반응형 폰트 크기 조정
 */
const MenuText = styled.span`
  font-size: 14px;
  color: #4A5568;
  font-weight: 500;
  white-space: nowrap;
  
  @media (min-width: 768px) {
    font-size: 16px;
  }
`;

/**
 * 우측 영역 컨테이너 - 로그인 버튼을 감싸는 영역
 * - 추후 추가 버튼이나 메뉴 확장 시 사용
 * - 충분한 최소 너비와 우측 고정 정렬 확보
 */
const Right = styled.div`
  display: flex;
  align-items: center;
  min-width: 120px;
  justify-content: flex-end;
  flex-shrink: 0;
  padding-right: 20px;
`;

/**
 * 로그인 버튼 스타일 - React Router Link 컴포넌트 확장
 * - 어두운 배경의 둥근 버튼 형태
 * - 호버 시 색상 변경 및 약간의 위로 이동 효과
 * - 링크이지만 버튼처럼 보이도록 스타일링
 */
const LoginButton = styled(Link)`
  padding: 8px 16px;
  background: #2D3748;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  
  &:hover {
    background: #1A202C;
    transform: translateY(-1px);
  }
`;

export default Topbar; 