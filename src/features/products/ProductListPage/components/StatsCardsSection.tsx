// Statistics cards section component
import React from 'react';
import DashboardStatsCard from './DashboardStatsCard';
import { Stats } from '../utils/statsUtils';

interface StatsCardsSectionProps {
  stats: Stats;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}

export const StatsCardsSection: React.FC<StatsCardsSectionProps> = ({ 
  stats, 
  activeFilter, 
  onFilterChange 
}) => {
  const handleCardClick = (filter: string) => {
    if (onFilterChange) {
      // 같은 필터 클릭 시 '전체'로 토글
      const newFilter = activeFilter === filter ? 'all' : filter;
      onFilterChange(newFilter);
    }
  };

  return (
    <div className="product-list-stats-section">
      <div className="product-list-stats-grid">
        <DashboardStatsCard 
          title="전체" 
          value={stats.total} 
          color="default" 
          onClick={() => handleCardClick('all')}
          active={activeFilter === 'all' || !activeFilter}
        />
        <DashboardStatsCard
          title="로켓그로스 재고"
          value={stats.rocketInventory}
          color="orange"
          onClick={() => handleCardClick('rocketInventory')}
          active={activeFilter === 'rocketInventory'}
        />
        <DashboardStatsCard 
          title="개인주문" 
          value={stats.personalOrder} 
          color="blue" 
          onClick={() => handleCardClick('personalOrder')}
          active={activeFilter === 'personalOrder'}
        />
        <DashboardStatsCard
          title="창고재고"
          value={stats.warehouseStock}
          color="green"
          onClick={() => handleCardClick('warehouseStock')}
          active={activeFilter === 'warehouseStock'}
        />
        <DashboardStatsCard 
          title="창고비" 
          value={stats.storageFee} 
          color="red" 
          onClick={() => handleCardClick('storageFee')}
          active={activeFilter === 'storageFee'}
        />
        <DashboardStatsCard 
          title="입력" 
          value={stats.inputData} 
          color="default" 
          onClick={() => handleCardClick('inputData')}
          active={activeFilter === 'inputData'}
        />
      </div>
    </div>
  );
};

export default StatsCardsSection;