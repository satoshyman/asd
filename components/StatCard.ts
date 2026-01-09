
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl shadow-xl hover:bg-slate-800 transition-colors">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-slate-400 font-medium">{title}</h3>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <i className={`fa-solid ${icon} ${color.replace('bg-', 'text-')}`}></i>
      </div>
    </div>
    <div className="text-3xl font-bold tracking-tight">{value}</div>
  </div>
);
