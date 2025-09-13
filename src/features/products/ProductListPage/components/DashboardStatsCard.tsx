import React from 'react';
import styled from 'styled-components';

interface DashboardStatsCardProps {
  title: string;
  value: number;
  hasInfo?: boolean;
  subtitle?: string;
  color?: 'default' | 'orange' | 'red' | 'blue' | 'green';
  onClick?: () => void;
  active?: boolean;
}

const DashboardStatsCard: React.FC<DashboardStatsCardProps> = ({ 
  title, 
  value, 
  hasInfo = false, 
  subtitle, 
  color = 'default',
  onClick,
  active = false
}) => {
  const getValueColor = () => {
    switch (color) {
      case 'orange':
        return '#F59E0B';
      case 'red':
        return '#EF4444';
      case 'blue':
        return '#3B82F6';
      case 'green':
        return '#10B981';
      default:
        return '#1F2937';
    }
  };

  const getBulletColor = () => {
    switch (color) {
      case 'orange':
        return '#F59E0B';
      case 'red':
        return '#EF4444';
      case 'blue':
        return '#3B82F6';
      case 'green':
        return '#10B981';
      default:
        return '#10B981';
    }
  };

  return (
    <StatsCard onClick={onClick} active={active} clickable={!!onClick}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {hasInfo && (
          <StatusBadge>
            <BulletPoint color={getBulletColor()} />
            정보
          </StatusBadge>
        )}
      </CardHeader>
      <CardContent>
        <MainValue color={getValueColor()}>
          {value.toLocaleString()}
        </MainValue>
        {subtitle && <SubText>{subtitle}</SubText>}
      </CardContent>
    </StatsCard>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 통계 카드
 * - 각각의 지표를 표시하는 카드
 * - 그림자와 호버 효과
 */
const StatsCard = styled.div<{ active?: boolean; clickable?: boolean }>`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  border: 1px solid ${props => props.active ? '#3B82F6' : '#E5E7EB'};
  cursor: ${props => props.clickable ? 'pointer' : 'default'};
  
  ${props => props.active && `
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
    background: #F8FAFF;
  `}
  
  &:hover {
    box-shadow: ${props => props.active ? '0 8px 24px rgba(59, 130, 246, 0.3)' : '0 8px 24px rgba(0, 0, 0, 0.15)'};
    transform: translateY(-4px);
  }
`;

/**
 * 카드 헤더
 * - 제목과 정보 표시
 */
const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

/**
 * 카드 제목
 */
const CardTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0;
`;

/**
 * 상태 배지
 */
const StatusBadge = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6B7280;
  background: #F3F4F6;
  padding: 4px 8px;
  border-radius: 8px;
`;

/**
 * 불릿 포인트
 */
const BulletPoint = styled.div<{ color: string }>`
  width: 8px;
  height: 8px;
  background: ${props => props.color};
  border-radius: 50%;
`;

/**
 * 카드 콘텐츠
 */
const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

/**
 * 메인 값 표시
 */
const MainValue = styled.div<{ color: string }>`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.color};
  line-height: 1.2;
`;

/**
 * 부가 텍스트
 */
const SubText = styled.div`
  font-size: 14px;
  color: #6B7280;
  margin-top: 4px;
`;

export default DashboardStatsCard; 