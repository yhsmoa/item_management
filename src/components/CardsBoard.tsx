import React from 'react';
import styled from 'styled-components';

/**
 * 카드 데이터 타입 정의
 */
interface CardData {
  id: string;
  icon: string;
  title: string;
  value: number | string;
  color?: string;
  onClick?: () => void;
}

/**
 * CardsBoard Props 타입 정의
 */
interface CardsBoardProps {
  cards: CardData[];
  columns?: number; // 한 줄에 표시할 카드 수 (기본값: auto-fit)
  className?: string;
}

/**
 * 재사용 가능한 통계 카드 보드 컴포넌트
 * - 여러 개의 통계 카드를 그리드 형태로 표시
 * - 다양한 페이지에서 공통으로 사용 가능
 */
const CardsBoard: React.FC<CardsBoardProps> = ({
  cards,
  columns,
  className
}) => {
  return (
    <CardsBoardContainer className={className} $columns={columns}>
      {cards.map((card) => (
        <StatCard 
          key={card.id} 
          onClick={card.onClick}
          $clickable={!!card.onClick}
          $color={card.color}
        >
          <StatIcon>{card.icon}</StatIcon>
          <StatInfo>
            <StatValue>{card.value}</StatValue>
            <StatTitle>{card.title}</StatTitle>
          </StatInfo>
        </StatCard>
      ))}
    </CardsBoardContainer>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 카드 보드 컨테이너
 */
const CardsBoardContainer = styled.div<{ $columns?: number }>`
  display: grid;
  grid-template-columns: ${props => 
    props.$columns 
      ? `repeat(${props.$columns}, 1fr)` 
      : 'repeat(auto-fit, minmax(200px, 1fr))'
  };
  gap: 20px;
  margin-bottom: 24px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

/**
 * 통계 카드
 */
const StatCard = styled.div<{ $clickable?: boolean; $color?: string }>`
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: ${props => props.$clickable ? 'pointer' : 'default'};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  ${props => props.$clickable && `
    &:active {
      transform: translateY(0);
    }
  `}

  @media (max-width: 480px) {
    padding: 16px;
  }
`;

/**
 * 통계 아이콘
 */
const StatIcon = styled.div<{ $color?: string }>`
  font-size: 32px;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$color || '#f3f4f6'};
  border-radius: 12px;
  flex-shrink: 0;

  @media (max-width: 480px) {
    width: 48px;
    height: 48px;
    font-size: 24px;
  }
`;

/**
 * 통계 정보
 */
const StatInfo = styled.div`
  flex: 1;
  min-width: 0; /* flex 아이템이 줄어들 수 있도록 */
`;

/**
 * 통계 값
 */
const StatValue = styled.h3`
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 4px 0;
  word-break: break-word;

  @media (max-width: 480px) {
    font-size: 20px;
  }
`;

/**
 * 통계 제목
 */
const StatTitle = styled.p`
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  word-break: break-word;
`;

export default CardsBoard; 