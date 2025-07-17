import React from 'react';
import styled from 'styled-components';

/**
 * TitleBoard Props 타입 정의
 */
interface TitleBoardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * 재사용 가능한 페이지 헤더 컴포넌트
 * - 제목, 부제목, 액션 버튼들을 표시
 * - 다양한 페이지에서 공통으로 사용 가능
 */
const TitleBoard: React.FC<TitleBoardProps> = ({
  title,
  subtitle,
  actions,
  className
}) => {
  return (
    <TitleBoardContainer className={className}>
      <HeaderTitle>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </HeaderTitle>
      {actions && (
        <HeaderActions>
          {actions}
        </HeaderActions>
      )}
    </TitleBoardContainer>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 타이틀 보드 컨테이너
 */
const TitleBoardContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding: 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
`;

/**
 * 헤더 타이틀 영역
 */
const HeaderTitle = styled.div`
  h1 {
    font-size: 28px;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 8px 0;

    @media (max-width: 480px) {
      font-size: 24px;
    }
  }

  p {
    font-size: 16px;
    color: #6b7280;
    margin: 0;
  }
`;

/**
 * 헤더 액션 영역
 */
const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  flex-shrink: 0;
`;

export default TitleBoard; 