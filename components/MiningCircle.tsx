
import React, { useState, useEffect } from 'react';

interface MiningCircleProps {
  hashRate: number;
  coinName: string;
  isMining: boolean;
  miningReward: number;
  timeToMining: string;
  currentLiveBonus: number;
}

interface Particle {
  id: number;
  val: string;
  x: number;
  y: number;
  scale: number;
  duration: number;
}

export const MiningCircle: React.FC<MiningCircleProps> = ({ 
  isMining, 
  miningReward, 
  timeToMining,
  currentLiveBonus
}) => {
  const [progress, setProgress] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [networkStats, setNetworkStats] = useState({
    height: 42158920,
    difficulty: '154.21 T',
    nodes: 342,
    efficiency: '99.8%'
  });

  const size = 280;
  const strokeWidth = 10;
  const center = size / 2;
  const radius = (size - strokeWidth * 4) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    let interval: any;
    if (isMining) {
      interval = setInterval(() => {
        const totalReward = miningReward || 0.00012;
        const currentProgress = (currentLiveBonus / totalReward) * 100;
        setProgress(currentProgress > 100 ? 100 : currentProgress);
        
        setNetworkStats(prev => ({
          ...prev,
          height: prev.height + Math.floor(Math.random() * 2),
          nodes: 340 + Math.floor(Math.random() * 3),
          efficiency: (99.4 + Math.random() * 0.5).toFixed(1) + '%'
        }));

        // Generate more dynamic particles
        if (Math.random() > 0.3) {
          const id = Date.now();
          setParticles(prev => [...prev, {
            id,
            val: `+${(Math.random() * 0.0000008).toFixed(9)}`,
            x: (Math.random() * 180) - 90,
            y: (Math.random() * -160) - 40,
            scale: 0.5 + Math.random() * 1,
            duration: 2 + Math.random() * 1.5
          }]);
          setTimeout(() => setParticles(p => p.filter(x => x.id !== id)), 3000);
        }
      }, 1000);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isMining, currentLiveBonus, miningReward]);

  return (
    <div className="relative flex flex-col items-center justify-center select-none w-full max-w-sm">
      
      {/* Enhanced Pulsating Aura */}
      <div className={`absolute w-64 h-64 rounded-full blur-[110px] transition-all duration-1000 mix-blend-screen ${isMining ? 'bg-blue-600/40 scale-150 animate-pulse' : 'bg-transparent'}`}></div>
      <div className={`absolute w-40 h-40 rounded-full blur-[60px] transition-all duration-700 ${isMining ? 'bg-cyan-400/20 scale-125' : 'bg-transparent'}`}></div>

      {/* Network Meta Header */}
      <div className="w-full flex justify-between px-2 mb-8 text-[9px] font-black uppercase tracking-[0.2em] text-gray-500/80">
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2"><span className={`w-1 h-1 rounded-full ${isMining ? 'bg-blue-500 shadow-[0_0_5px_#3b82f6]' : 'bg-gray-700'}`}></span> Height: <b className="text-gray-300 tabular-nums">{networkStats.height}</b></span>
          <span className="flex items-center gap-2"><span className={`w-1 h-1 rounded-full ${isMining ? 'bg-blue-500 shadow-[0_0_5px_#3b82f6]' : 'bg-gray-700'}`}></span> Nodes: <b className="text-gray-300 tabular-nums">{networkStats.nodes}</b></span>
        </div>
        <div className="flex flex-col gap-1.5 text-right">
          <span className="flex items-center justify-end gap-2">Efficiency: <b className="text-emerald-500">{networkStats.efficiency}</b> <span className="w-1 h-1 bg-emerald-500 rounded-full"></span></span>
          <span className="flex items-center justify-end gap-2">Status: <b className={isMining ? 'text-blue-400' : 'text-red-500'}>{isMining ? 'ACTIVE_NODE' : 'STANDBY'}</b> <span className={`w-1.5 h-1.5 rounded-full ${isMining ? 'bg-blue-400 animate-ping' : 'bg-red-500'}`}></span></span>
        </div>
      </div>

      {/* Reactor Core */}
      <div className="relative p-2 rounded-full bg-gradient-to-b from-white/10 to-transparent border border-white/5 shadow-inner mb-8 transition-transform duration-500 hover:scale-[1.02]">
        
        {/* Orbital Particles Layer */}
        <div className="absolute inset-0 pointer-events-none z-40 overflow-visible">
          {particles.map(p => (
            <div 
              key={p.id}
              className="absolute left-1/2 top-1/2 font-black text-blue-300 text-[10px] whitespace-nowrap opacity-0 animate-ton-orbital"
              style={{ 
                '--tx': `${p.x}px`, 
                '--ty': `${p.y}px`,
                '--scale': p.scale,
                '--dur': `${p.duration}s`
              } as any}
            >
              <i className="fa-solid fa-bolt-lightning text-[8px] mr-1 opacity-50"></i>
              {p.val}
            </div>
          ))}
        </div>

        <svg width={size} height={size} className="-rotate-90 relative z-10 filter drop-shadow-[0_0_15px_rgba(0,136,204,0.2)]">
          <defs>
            <linearGradient id="tonGrad" x1="0%" y1="0%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#0088cc" />
              <stop offset="50%" stopColor="#00fbff" />
              <stop offset="100%" stopColor="#0088cc" />
            </linearGradient>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          {/* Static Background Path */}
          <circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} fill="transparent" />
          
          {/* Shimmer Effect Path (Layer 1) */}
          {isMining && (
            <circle
              cx={center} cy={center} r={radius}
              stroke="rgba(0, 251, 255, 0.1)" strokeWidth={strokeWidth + 4} fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (circumference * progress) / 100}
              className="animate-pulse"
            />
          )}

          {/* Main Progress Ring */}
          <circle
            cx={center} cy={center} r={radius}
            stroke="url(#tonGrad)" strokeWidth={strokeWidth} fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * progress) / 100}
            strokeLinecap="round"
            filter={isMining ? "url(#neonGlow)" : ""}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className={`w-16 h-16 rounded-[1.5rem] bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center mb-2 transition-all duration-700 ${isMining ? 'shadow-[0_0_50px_rgba(0,136,204,0.5)] border-blue-400/40 scale-110 rotate-[360deg]' : ''}`}>
             <i className={`fa-solid fa-gem text-2xl transition-colors duration-500 ${isMining ? 'text-blue-400' : 'text-gray-800'}`}></i>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mb-0.5">Yield Rate</p>
            <h2 className="text-4xl font-black text-white tracking-tighter tabular-nums drop-shadow-lg">
              {currentLiveBonus.toFixed(8)}
            </h2>
            <div className="flex items-center justify-center gap-1 mt-1">
              <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></span>
              <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">TON / SEC</p>
            </div>
          </div>
        </div>
      </div>

      {/* Session Details Card */}
      <div className="w-full bg-[#0a0a0a]/80 border border-white/5 rounded-[2.5rem] p-7 space-y-5 backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
        
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div>
            <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] block mb-1">Expected Payout</span>
            <span className="text-base font-black text-blue-400 group-hover:text-blue-300 transition-colors tracking-tight">+{miningReward.toFixed(5)} TON</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-500">
            <i className="fa-solid fa-vault"></i>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[8px] font-black text-gray-600 uppercase mb-1 tracking-widest">Network Load</p>
            <div className="flex items-baseline gap-1">
              <p className="text-xl font-black text-white">{progress.toFixed(1)}</p>
              <span className="text-[10px] text-blue-500">%</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-gray-600 uppercase mb-1 tracking-widest">Cycle Timer</p>
            <p className="text-xl font-black text-blue-100 tabular-nums">{timeToMining}</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-4 border border-white/5 transition-colors group-hover:bg-white/[0.07]">
          <div className="w-9 h-9 rounded-xl bg-blue-500 text-black flex items-center justify-center shadow-lg shadow-blue-500/20">
            <i className="fa-solid fa-bolt-lightning text-sm"></i>
          </div>
          <div>
            <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Node Throughput</p>
            <p className="text-[11px] font-black text-gray-200 uppercase tracking-tighter">4.21 TH/s <span className="text-blue-500/50 ml-1">SHA-256</span></p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ton-orbital {
          0% { 
            transform: translate(-50%, -50%) scale(0.3) rotate(0deg); 
            opacity: 0; 
          }
          10% { opacity: 1; }
          40% { transform: translate(calc(-50% + var(--tx) * 0.5), calc(-50% + var(--ty) * 0.5)) scale(var(--scale)) rotate(15deg); }
          100% { 
            transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.2) rotate(45deg); 
            opacity: 0; 
          }
        }
        .animate-ton-orbital { 
          animation: ton-orbital var(--dur) cubic-bezier(0.1, 0.8, 0.2, 1) forwards; 
        }
      `}</style>
    </div>
  );
};
