import React from 'react';

interface StatsCardProps {
  title: string;
  value: number;
  hasInfo?: boolean;
  subtitle?: string;
  color?: 'default' | 'orange' | 'red' | 'blue';
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  hasInfo = false, 
  subtitle, 
  color = 'default' 
}) => {
  const getValueColorClass = () => {
    switch (color) {
      case 'orange':
        return 'text-orange-600';
      case 'red':
        return 'text-red-600';
      case 'blue':
        return 'text-blue-600';
      default:
        return 'text-gray-900';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-md hover:shadow-lg transition-shadow duration-200">
      <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
        {title}
        {hasInfo && <span className="text-gray-400">ⓘ</span>}
      </div>
      <div className={`text-2xl font-bold ${getValueColorClass()}`}>
        {value.toLocaleString()}
      </div>
      {subtitle && (
        <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
};

export default StatsCard; 