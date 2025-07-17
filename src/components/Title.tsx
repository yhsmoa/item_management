import React from 'react';
import styled from 'styled-components';

/**
 * Title Props 타입 정의
 */
interface TitleProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * 순수한 타이틀 컴포넌트 (보드 없음)
 * - 제목, 부제목, 액션 버튼들을 표시
 * - 배경이나 보드 스타일 없이 페이지에 직접 표시
 */
const Title: React.FC<TitleProps> = ({
  title,
  subtitle,
  actions,
  className
}) => {
  return (
    <TitleContainer className={className}>
      <TitleContent>
        <MainTitle>{title}</MainTitle>
        {subtitle && <Subtitle>{subtitle}</Subtitle>}
      </TitleContent>
      {actions && (
        <ActionsContainer>
          {actions}
        </ActionsContainer>
      )}
    </TitleContainer>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 타이틀 컨테이너 (보드 스타일 없음)
 */
const TitleContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
`;

/**
 * 타이틀 콘텐츠 영역
 */
const TitleContent = styled.div`
  flex: 1;
`;

/**
 * 메인 타이틀
 */
const MainTitle = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px 0;
  line-height: 1.2;

  @media (max-width: 768px) {
    font-size: 28px;
  }

  @media (max-width: 480px) {
    font-size: 24px;
  }
`;

/**
 * 부제목
 */
const Subtitle = styled.p`
  font-size: 16px;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;

  @media (max-width: 480px) {
    font-size: 14px;
  }
`;

/**
 * 액션 컨테이너
 */
const ActionsContainer = styled.div`
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  align-items: flex-start;

  @media (max-width: 768px) {
    justify-content: stretch;
  }
`;

export default Title; 