
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, setDoc, updateDoc, onSnapshot, 
  increment, Timestamp, collection, query, where, addDoc, orderBy, limit
} from "firebase/firestore";
import { MiningCircle } from './components/MiningCircle';

// تكوين قاعدة البيانات - ثابت ومعتمد
const firebaseConfig = {
  apiKey: "AIzaSyDJyfwXc8BsTPYE6AWfRtb1tNAyIjMeRgQ",
  authDomain: "beeclaimer-5b76e.firebaseapp.com",
  projectId: "beeclaimer-5b76e",
  storageBucket: "beeclaimer-5b76e.firebasestorage.app",
  messagingSenderId: "236039270574",
  appId: "1:236039270574:web:25cf83aafd129a00abbd3f",
  measurementId: "G-SNT42HHKR2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_CONFIG = {
  faucetReward: 0.0001,
  faucetIntervalHours: 6,
  miningReward: 0.00012,
  miningIntervalHours: 4,
  referralReward: 0.0001,
  minWithdrawal: 0.01,
  adsgramBlockId: "YOUR_BLOCK_ID",
  adminPass: "1234" 
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'mining' | 'friends' | 'admin'>('home');
  const [userId, setUserId] = useState<string>('guest_user');
  const [userData, setUserData] = useState<any>(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  
  const [displayBalance, setDisplayBalance] = useState<number>(0);
  const [timeToFaucet, setTimeToFaucet] = useState('00:00:00');
  const [faucetProgress, setFaucetProgress] = useState(100);
  const [timeToMining, setTimeToMining] = useState('00:00:00');
  const [isMiningActive, setIsMiningActive] = useState(false);
  const [liveMiningBonus, setLiveMiningBonus] = useState(0);
  const [liveFaucetAccumulated, setLiveFaucetAccumulated] = useState(0);
  const [referralsList, setReferralsList] = useState<any[]>([]);
  
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawHistory, setWithdrawHistory] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminInputPass, setAdminInputPass] = useState('');
  const [allWithdrawals, setAllWithdrawals] = useState<any[]>([]);

  // منطق الضغط السري (8 مرات للدخول للوحة التحكم)
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);

  const handleSecretClick = () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current > 1000) {
      clickCountRef.current = 1;
    } else {
      clickCountRef.current += 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= 8) {
      setActiveTab('admin');
      clickCountRef.current = 0;
    }
  };

  useEffect(() => {
    let tid = 'guest_user';
    let tname = 'Bee Worker';
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      tg.expand();
      tid = tg.initDataUnsafe.user.id.toString();
      tname = tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name;
    }
    setUserId(tid);

    onSnapshot(doc(db, "settings", "global"), (snap) => {
      if (snap.exists()) setConfig(prev => ({ ...prev, ...snap.data() }));
    });

    const userRef = doc(db, "users", tid);
    onSnapshot(userRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        setDisplayBalance(data.balance || 0);
      } else {
        await setDoc(userRef, {
          id: tid, username: tname, balance: 0, referralCount: 0,
          lastFaucet: Date.now() - (DEFAULT_CONFIG.faucetIntervalHours * 3600000),
          lastMining: 0, joined: Timestamp.now(),
          referredBy: (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || null
        });
      }
      setLoading(false);
    });

    const qW = query(collection(db, "withdrawals"), where("userId", "==", tid), limit(10));
    onSnapshot(qW, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setWithdrawHistory(docs);
    });

    const qR = query(collection(db, "users"), where("referredBy", "==", tid), limit(20));
    onSnapshot(qR, (snap) => setReferralsList(snap.docs.map(d => d.data())));

    const qAllW = query(collection(db, "withdrawals"), orderBy("timestamp", "desc"), limit(50));
    onSnapshot(qAllW, (snap) => setAllWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (userData) {
        const now = Date.now();
        const fIntervalMs = config.faucetIntervalHours * 3600000;
        const fLastClaim = userData.lastFaucet || 0;
        const fNextClaim = fLastClaim + fIntervalMs;
        
        if (now >= fNextClaim) {
          setTimeToFaucet('Ready');
          setLiveFaucetAccumulated(config.faucetReward);
          setFaucetProgress(100);
        } else {
          const timeLeft = fNextClaim - now;
          setTimeToFaucet(formatMs(timeLeft));
          const elapsed = now - fLastClaim;
          const ratio = Math.max(0, Math.min(elapsed / fIntervalMs, 1));
          setLiveFaucetAccumulated(ratio * config.faucetReward);
          setFaucetProgress((timeLeft / fIntervalMs) * 100);
        }

        const mIntervalMs = config.miningIntervalHours * 3600000;
        const mNext = (userData.lastMining || 0) + mIntervalMs;
        if (now < mNext && userData.lastMining !== 0) {
          setIsMiningActive(true);
          setTimeToMining(formatMs(mNext - now));
          const elapsed = now - userData.lastMining;
          const mRatio = Math.max(0, Math.min(elapsed / mIntervalMs, 1));
          setLiveMiningBonus(mRatio * config.miningReward);
        } else {
          setIsMiningActive(false);
          setTimeToMining('Ready');
          setLiveMiningBonus(0);
        }
      }
    }, 100);
    return () => clearInterval(timer);
  }, [userData, config]);

  const formatMs = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleClaimFaucet = async () => {
    if (timeToFaucet !== 'Ready') return;
    const AdController = (window as any).Adsgram?.init({ blockId: config.adsgramBlockId });
    if (AdController) {
      AdController.show().then(async () => {
        await updateDoc(doc(db, "users", userId), { 
          balance: increment(config.faucetReward), 
          lastFaucet: Date.now() 
        });
      }).catch(() => alert("Ad required for claim"));
    } else {
      await updateDoc(doc(db, "users", userId), { 
        balance: increment(config.faucetReward), 
        lastFaucet: Date.now() 
      });
    }
  };

  const handleWithdrawRequest = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!withdrawAddress || isNaN(amount) || amount < config.minWithdrawal) return alert(`Minimum ${config.minWithdrawal} TON`);
    if (amount > (displayBalance + liveMiningBonus)) return alert("Insufficient balance");
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "withdrawals"), { 
        userId, 
        address: withdrawAddress, 
        amount, 
        status: 'pending', 
        timestamp: Timestamp.now() 
      });
      await updateDoc(doc(db, "users", userId), { balance: increment(-amount) });
      setShowWithdrawModal(false);
      alert("Withdrawal request sent!");
    } catch (e) { alert("Network error"); }
    setIsSubmitting(false);
  };

  if (loading) return (
    <div className="h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4 text-center px-6">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-blue-500 font-black tracking-[0.3em] text-[10px] uppercase">Booting BeeClaimer OS</p>
    </div>
  );

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden font-sans relative selection:bg-blue-500/30">
      
      {/* مودال السحب الاحترافي */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl transition-opacity" onClick={() => setShowWithdrawModal(false)}></div>
          <div className="relative w-full max-w-md bg-[#0c0c0c] border border-white/10 rounded-[3rem] p-8 pb-12 space-y-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-20 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
               <div className="flex flex-col">
                 <h3 className="text-2xl font-black uppercase tracking-tight">Withdrawal Hub</h3>
                 <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Network: TON Blockchain</p>
               </div>
               <button onClick={() => setShowWithdrawModal(false)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>

            <div className="bg-white/5 border border-white/5 p-6 rounded-[2rem] flex justify-between items-center">
               <div>
                 <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Total Redeemable</p>
                 <p className="text-3xl font-black text-white tabular-nums">{(displayBalance + liveMiningBonus).toFixed(6)} <span className="text-blue-500 text-xs">TON</span></p>
               </div>
               <div className="w-12 h-12 bg-blue-600/20 text-blue-500 rounded-2xl flex items-center justify-center"><i className="fa-solid fa-vault text-lg"></i></div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-gray-600 ml-4">Destination Wallet</label>
                <input type="text" placeholder="UQ... or EQ..." className="w-full bg-white/5 border border-white/10 p-5 rounded-[1.5rem] font-bold focus:border-blue-500 focus:bg-white/[0.07] outline-none transition-all" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-gray-600 ml-4">Withdraw Amount (Min: {config.minWithdrawal})</label>
                <div className="relative">
                  <input type="number" placeholder="0.00" className="w-full bg-white/5 border border-white/10 p-5 rounded-[1.5rem] font-bold focus:border-blue-500 outline-none" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                  <button onClick={() => setWithdrawAmount((displayBalance + liveMiningBonus).toFixed(6))} className="absolute right-4 top-4 bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600/40 transition-colors">Max</button>
                </div>
              </div>
              <button onClick={handleWithdrawRequest} disabled={isSubmitting} className="w-full bg-blue-600 py-6 rounded-[2rem] font-black uppercase tracking-[0.4em] shadow-xl shadow-blue-600/40 active:scale-95 transition-all text-[12px] flex items-center justify-center gap-3">
                {isSubmitting ? <><i className="fa-solid fa-circle-notch animate-spin"></i> TRANSMITTING...</> : "Initiate Payout"}
              </button>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-4">
              <h4 className="text-[10px] font-black text-gray-700 uppercase tracking-[0.3em] ml-2">Recent Transactions</h4>
              {withdrawHistory.length === 0 ? (
                <p className="text-center py-8 text-gray-800 font-black text-[9px] uppercase tracking-widest">No transaction data</p>
              ) : withdrawHistory.map((h: any) => (
                <div key={h.id} className="bg-white/5 p-5 rounded-[1.5rem] flex justify-between items-center border border-white/5 group hover:bg-white/[0.08] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm ${h.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : h.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                       <i className={`fa-solid ${h.status === 'completed' ? 'fa-check' : h.status === 'rejected' ? 'fa-x' : 'fa-clock'}`}></i>
                    </div>
                    <div>
                      <p className="font-black text-sm">-{h.amount} TON</p>
                      <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">{h.timestamp?.toDate()?.toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg border ${h.status === 'completed' ? 'border-emerald-500/20 text-emerald-500' : h.status === 'rejected' ? 'border-red-500/20 text-red-500' : 'border-yellow-500/20 text-yellow-500'}`}>
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* الهيدر مع المنطقة السرية المخفية تماماً */}
      <header className="px-6 py-5 flex justify-between items-center border-b border-white/5 backdrop-blur-lg relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-xl flex items-center justify-center text-white shadow-lg"><i className="fa-solid fa-microchip animate-pulse"></i></div>
          <h2 className="text-[11px] font-black uppercase tracking-widest">BeeClaimer <span className="text-blue-500">Pro</span></h2>
        </div>
        
        {/* زر سري مخفي تماماً - يتطلب 8 ضغطات متتالية */}
        <button 
          onClick={handleSecretClick} 
          className="w-12 h-12 rounded-xl bg-transparent opacity-0 cursor-default flex items-center justify-center transition-none"
          aria-hidden="true"
        >
          <i className="fa-solid fa-fingerprint"></i>
        </button>
      </header>

      <main className="flex-grow overflow-y-auto px-6 pb-36 pt-6 space-y-6">
        
        {activeTab === 'home' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-gradient-to-br from-blue-900/50 via-[#0c0c0c] to-[#050505] border border-blue-500/20 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
               <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]"></div>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Core Balance</p>
              <h1 className="text-6xl font-black tracking-tighter tabular-nums flex items-baseline gap-2 mb-8">
                {(displayBalance + liveMiningBonus).toFixed(8)} <span className="text-blue-500 text-lg">TON</span>
              </h1>
              <button onClick={() => setShowWithdrawModal(true)} className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-xl shadow-blue-600/40 active:scale-95 transition-all">Open Wallet</button>
            </div>

            <div className="bg-[#0c0c0c] border border-emerald-500/20 rounded-[2.5rem] p-7 flex flex-col gap-5 group relative overflow-hidden transition-all hover:border-emerald-500/40">
               {timeToFaucet !== 'Ready' && (
                 <div 
                   className="absolute bottom-0 left-0 h-1 bg-emerald-500/40 shadow-[0_0_10px_#10b981] transition-all duration-1000" 
                   style={{ width: `${faucetProgress}%` }}
                 ></div>
               )}
               <div className="flex items-center justify-between w-full">
                 <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 ${timeToFaucet === 'Ready' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 rotate-[360deg]' : 'bg-white/5 text-emerald-500/20'}`}><i className="fa-solid fa-faucet-drip"></i></div>
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Capped Yield</p>
                      <p className="text-2xl font-black text-white tabular-nums">{liveFaucetAccumulated.toFixed(6)}</p>
                    </div>
                 </div>
                 <button onClick={handleClaimFaucet} disabled={timeToFaucet !== 'Ready'} className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase transition-all duration-300 ${timeToFaucet === 'Ready' ? 'bg-white text-black active:scale-90 shadow-xl' : 'bg-white/5 text-gray-700'}`}>
                   {timeToFaucet === 'Ready' ? 'CLAIM' : timeToFaucet}
                 </button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'mining' && (
          <div className="flex flex-col items-center animate-in fade-in py-4">
             <MiningCircle hashRate={4210} coinName="TON" isMining={isMiningActive} miningReward={config.miningReward} timeToMining={timeToMining} currentLiveBonus={liveMiningBonus} />
             <button onClick={async () => {
               if (isMiningActive) return;
               await updateDoc(doc(db, "users", userId), { lastMining: Date.now() });
             }} disabled={isMiningActive} className={`w-full max-w-sm mt-12 py-7 rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.5em] transition-all ${!isMiningActive ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/30 active:scale-95' : 'bg-white/5 text-gray-700'}`}>
                {!isMiningActive ? 'IGNITE CLOUD MINER' : 'MINING PROCESS ACTIVE'}
             </button>
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-gradient-to-br from-pink-900/40 via-[#0c0c0c] to-[#050505] border border-pink-500/20 rounded-[3rem] p-10 text-center relative overflow-hidden group">
                <div className="w-20 h-20 bg-pink-600 rounded-[2rem] mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-pink-600/40 mb-8"><i className="fa-solid fa-users"></i></div>
                <h3 className="text-3xl font-black uppercase tracking-tight mb-2">Hive Collective</h3>
                <p className="text-pink-400 font-black text-[10px] uppercase tracking-[0.3em]">Yield {config.referralReward} TON per recruit</p>
                <button onClick={() => window.open(`https://t.me/share/url?url=https://t.me/${(window as any).Telegram?.WebApp?.initDataUnsafe?.bot_name || 'Bot'}?start=${userId}`)} className="w-full mt-10 bg-pink-600 py-6 rounded-[2rem] font-black text-[12px] uppercase tracking-widest shadow-xl shadow-pink-600/20 active:scale-95 transition-all">RECRUIT PEERS</button>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] text-center"><p className="text-[10px] text-gray-600 font-black uppercase mb-2">Active Peers</p><p className="text-4xl font-black">{userData?.referralCount || 0}</p></div>
               <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] text-center"><p className="text-[10px] text-gray-600 font-black uppercase mb-2">Total Yield</p><p className="text-4xl font-black text-pink-500">{(userData?.referralCount || 0 * config.referralReward).toFixed(4)}</p></div>
             </div>

             <div className="space-y-4">
               {referralsList.map((ref, i) => (
                 <div key={i} className="bg-white/5 p-6 rounded-3xl flex justify-between items-center border border-transparent hover:border-pink-500/10 transition-all">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-pink-500/10 text-pink-500 flex items-center justify-center rounded-2xl font-black text-sm">#{i+1}</div>
                      <p className="text-sm font-black">{ref.username || 'PEER'}</p>
                    </div>
                    <p className="text-xs font-black text-emerald-400">+{config.referralReward} TON</p>
                 </div>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-8 animate-in fade-in">
             {!isAdminAuthenticated ? (
               <div className="bg-[#0c0c0c] p-12 rounded-[3rem] border border-white/5 text-center shadow-2xl">
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-8">ADMIN ACCESS</h3>
                  <input type="password" placeholder="PIN" className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl mb-6 text-center text-2xl font-black tracking-[0.5em] outline-none" value={adminInputPass} onChange={(e) => setAdminInputPass(e.target.value)} />
                  <button onClick={() => adminInputPass === config.adminPass ? setIsAdminAuthenticated(true) : alert("WRONG PIN")} className="w-full bg-white text-black py-6 rounded-[2rem] font-black uppercase active:scale-95 transition-all">Authorize</button>
               </div>
             ) : (
               <div className="space-y-10">
                  <div className="bg-[#0c0c0c] p-8 rounded-[3rem] border border-blue-500/20">
                     <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-10 text-center border-b border-white/5 pb-4">Global System Settings</h4>
                     <div className="space-y-6">
                        {[
                          { key: 'faucetReward', label: 'Faucet Amount', step: 0.0001 },
                          { key: 'faucetIntervalHours', label: 'Faucet Time (Hours)', step: 1 },
                          { key: 'miningReward', label: 'Mining Reward', step: 0.0001 },
                          { key: 'miningIntervalHours', label: 'Mining Time (Hours)', step: 1 },
                          { key: 'referralReward', label: 'Referral Bonus', step: 0.0001 },
                          { key: 'minWithdrawal', label: 'Min Withdrawal', step: 0.001 }
                        ].map((field) => (
                          <div key={field.key} className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase text-gray-600 ml-2">{field.label}</label>
                            <input type="number" step={field.step} className="bg-white/5 border border-white/10 p-4 rounded-xl w-full font-black text-right outline-none focus:border-blue-500" value={(config as any)[field.key]} onChange={(e) => setConfig({...config, [field.key]: parseFloat(e.target.value)})} />
                          </div>
                        ))}
                        <div className="flex flex-col gap-2 pt-2">
                           <label className="text-[10px] font-black uppercase text-gray-600 ml-2">Adsgram Block ID</label>
                           <input type="text" className="bg-white/5 border border-white/10 p-4 rounded-xl font-bold outline-none focus:border-blue-500" value={config.adsgramBlockId} onChange={(e) => setConfig({...config, adsgramBlockId: e.target.value})} />
                        </div>
                        <button onClick={async () => { await setDoc(doc(db, "settings", "global"), config); alert("Updated"); }} className="w-full bg-blue-600 py-6 rounded-[2rem] font-black text-[12px] tracking-[0.4em] active:scale-95 shadow-xl shadow-blue-600/30">UPDATE CONFIG</button>
                     </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-yellow-500 uppercase tracking-widest ml-4">PENDING WITHDRAWALS</h4>
                    {allWithdrawals.filter(w => w.status === 'pending').map((w: any) => (
                      <div key={w.id} className="bg-[#0c0c0c] border border-white/5 p-8 rounded-[3rem] space-y-6 shadow-xl animate-in fade-in">
                         <div className="flex justify-between items-start">
                           <p className="text-3xl font-black">{w.amount} <span className="text-xs text-gray-600">TON</span></p>
                           <span className="bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border border-yellow-500/20">Pending</span>
                         </div>
                         <p className="text-xs text-blue-400 font-black break-all select-all bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">{w.address}</p>
                         <div className="grid grid-cols-2 gap-4">
                           <button onClick={async () => { await updateDoc(doc(db, "withdrawals", w.id), {status: 'completed'}); alert("Approved!"); }} className="bg-emerald-600/90 py-4 rounded-2xl font-black text-[11px]">APPROVE</button>
                           <button onClick={async () => { await updateDoc(doc(db, "withdrawals", w.id), {status: 'rejected'}); alert("Rejected"); }} className="bg-red-600/90 py-4 rounded-2xl font-black text-[11px]">REJECT</button>
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>
        )}

      </main>

      <nav className="fixed bottom-0 left-0 right-0 p-6 z-50">
        <div className="max-w-md mx-auto bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-2 flex justify-around shadow-2xl">
          {[
            { id: 'home', icon: 'fa-wallet', label: 'Vault' },
            { id: 'mining', icon: 'fa-microchip', label: 'Miner' },
            { id: 'friends', icon: 'fa-users', label: 'Hive' }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-4 rounded-[2rem] flex flex-col items-center gap-1.5 transition-all ${activeTab === tab.id ? 'bg-white text-black shadow-2xl scale-105' : 'text-gray-500'}`}>
              <i className={`fa-solid ${tab.icon} text-base`}></i>
              <span className="text-[9px] font-black uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <style>{`
        ::-webkit-scrollbar { display: none; }
        .animate-in { animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default App;

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, setDoc, updateDoc, onSnapshot, 
  increment, Timestamp, collection, query, where, addDoc, orderBy, limit
} from "firebase/firestore";
import { MiningCircle } from './components/MiningCircle';

// تكوين قاعدة البيانات - ثابت ومعتمد
const firebaseConfig = {
  apiKey: "AIzaSyDJyfwXc8BsTPYE6AWfRtb1tNAyIjMeRgQ",
  authDomain: "beeclaimer-5b76e.firebaseapp.com",
  projectId: "beeclaimer-5b76e",
  storageBucket: "beeclaimer-5b76e.firebasestorage.app",
  messagingSenderId: "236039270574",
  appId: "1:236039270574:web:25cf83aafd129a00abbd3f",
  measurementId: "G-SNT42HHKR2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_CONFIG = {
  faucetReward: 0.0001,
  faucetIntervalHours: 6,
  miningReward: 0.00012,
  miningIntervalHours: 4,
  referralReward: 0.0001,
  minWithdrawal: 0.01,
  adsgramBlockId: "YOUR_BLOCK_ID",
  adminPass: "1234" 
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'mining' | 'friends' | 'admin'>('home');
  const [userId, setUserId] = useState<string>('guest_user');
  const [userData, setUserData] = useState<any>(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  
  const [displayBalance, setDisplayBalance] = useState<number>(0);
  const [timeToFaucet, setTimeToFaucet] = useState('00:00:00');
  const [faucetProgress, setFaucetProgress] = useState(100);
  const [timeToMining, setTimeToMining] = useState('00:00:00');
  const [isMiningActive, setIsMiningActive] = useState(false);
  const [liveMiningBonus, setLiveMiningBonus] = useState(0);
  const [liveFaucetAccumulated, setLiveFaucetAccumulated] = useState(0);
  const [referralsList, setReferralsList] = useState<any[]>([]);
  
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawHistory, setWithdrawHistory] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminInputPass, setAdminInputPass] = useState('');
  const [allWithdrawals, setAllWithdrawals] = useState<any[]>([]);

  // منطق الضغط السري (8 مرات للدخول للوحة التحكم)
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);

  const handleSecretClick = () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current > 1000) {
      clickCountRef.current = 1;
    } else {
      clickCountRef.current += 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= 8) {
      setActiveTab('admin');
      clickCountRef.current = 0;
    }
  };

  useEffect(() => {
    let tid = 'guest_user';
    let tname = 'Bee Worker';
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      tg.expand();
      tid = tg.initDataUnsafe.user.id.toString();
      tname = tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name;
    }
    setUserId(tid);

    onSnapshot(doc(db, "settings", "global"), (snap) => {
      if (snap.exists()) setConfig(prev => ({ ...prev, ...snap.data() }));
    });

    const userRef = doc(db, "users", tid);
    onSnapshot(userRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        setDisplayBalance(data.balance || 0);
      } else {
        await setDoc(userRef, {
          id: tid, username: tname, balance: 0, referralCount: 0,
          lastFaucet: Date.now() - (DEFAULT_CONFIG.faucetIntervalHours * 3600000),
          lastMining: 0, joined: Timestamp.now(),
          referredBy: (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || null
        });
      }
      setLoading(false);
    });

    const qW = query(collection(db, "withdrawals"), where("userId", "==", tid), limit(10));
    onSnapshot(qW, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setWithdrawHistory(docs);
    });

    const qR = query(collection(db, "users"), where("referredBy", "==", tid), limit(20));
    onSnapshot(qR, (snap) => setReferralsList(snap.docs.map(d => d.data())));

    const qAllW = query(collection(db, "withdrawals"), orderBy("timestamp", "desc"), limit(50));
    onSnapshot(qAllW, (snap) => setAllWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (userData) {
        const now = Date.now();
        const fIntervalMs = config.faucetIntervalHours * 3600000;
        const fLastClaim = userData.lastFaucet || 0;
        const fNextClaim = fLastClaim + fIntervalMs;
        
        if (now >= fNextClaim) {
          setTimeToFaucet('Ready');
          setLiveFaucetAccumulated(config.faucetReward);
          setFaucetProgress(100);
        } else {
          const timeLeft = fNextClaim - now;
          setTimeToFaucet(formatMs(timeLeft));
          const elapsed = now - fLastClaim;
          const ratio = Math.max(0, Math.min(elapsed / fIntervalMs, 1));
          setLiveFaucetAccumulated(ratio * config.faucetReward);
          setFaucetProgress((timeLeft / fIntervalMs) * 100);
        }

        const mIntervalMs = config.miningIntervalHours * 3600000;
        const mNext = (userData.lastMining || 0) + mIntervalMs;
        if (now < mNext && userData.lastMining !== 0) {
          setIsMiningActive(true);
          setTimeToMining(formatMs(mNext - now));
          const elapsed = now - userData.lastMining;
          const mRatio = Math.max(0, Math.min(elapsed / mIntervalMs, 1));
          setLiveMiningBonus(mRatio * config.miningReward);
        } else {
          setIsMiningActive(false);
          setTimeToMining('Ready');
          setLiveMiningBonus(0);
        }
      }
    }, 100);
    return () => clearInterval(timer);
  }, [userData, config]);

  const formatMs = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleClaimFaucet = async () => {
    if (timeToFaucet !== 'Ready') return;
    const AdController = (window as any).Adsgram?.init({ blockId: config.adsgramBlockId });
    if (AdController) {
      AdController.show().then(async () => {
        await updateDoc(doc(db, "users", userId), { 
          balance: increment(config.faucetReward), 
          lastFaucet: Date.now() 
        });
      }).catch(() => alert("Ad required for claim"));
    } else {
      await updateDoc(doc(db, "users", userId), { 
        balance: increment(config.faucetReward), 
        lastFaucet: Date.now() 
      });
    }
  };

  const handleWithdrawRequest = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!withdrawAddress || isNaN(amount) || amount < config.minWithdrawal) return alert(`Minimum ${config.minWithdrawal} TON`);
    if (amount > (displayBalance + liveMiningBonus)) return alert("Insufficient balance");
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "withdrawals"), { 
        userId, 
        address: withdrawAddress, 
        amount, 
        status: 'pending', 
        timestamp: Timestamp.now() 
      });
      await updateDoc(doc(db, "users", userId), { balance: increment(-amount) });
      setShowWithdrawModal(false);
      alert("Withdrawal request sent!");
    } catch (e) { alert("Network error"); }
    setIsSubmitting(false);
  };

  if (loading) return (
    <div className="h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4 text-center px-6">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-blue-500 font-black tracking-[0.3em] text-[10px] uppercase">Booting BeeClaimer OS</p>
    </div>
  );

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden font-sans relative selection:bg-blue-500/30">
      
      {/* مودال السحب الاحترافي */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl transition-opacity" onClick={() => setShowWithdrawModal(false)}></div>
          <div className="relative w-full max-w-md bg-[#0c0c0c] border border-white/10 rounded-[3rem] p-8 pb-12 space-y-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-20 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
               <div className="flex flex-col">
                 <h3 className="text-2xl font-black uppercase tracking-tight">Withdrawal Hub</h3>
                 <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Network: TON Blockchain</p>
               </div>
               <button onClick={() => setShowWithdrawModal(false)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>

            <div className="bg-white/5 border border-white/5 p-6 rounded-[2rem] flex justify-between items-center">
               <div>
                 <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Total Redeemable</p>
                 <p className="text-3xl font-black text-white tabular-nums">{(displayBalance + liveMiningBonus).toFixed(6)} <span className="text-blue-500 text-xs">TON</span></p>
               </div>
               <div className="w-12 h-12 bg-blue-600/20 text-blue-500 rounded-2xl flex items-center justify-center"><i className="fa-solid fa-vault text-lg"></i></div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-gray-600 ml-4">Destination Wallet</label>
                <input type="text" placeholder="UQ... or EQ..." className="w-full bg-white/5 border border-white/10 p-5 rounded-[1.5rem] font-bold focus:border-blue-500 focus:bg-white/[0.07] outline-none transition-all" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-gray-600 ml-4">Withdraw Amount (Min: {config.minWithdrawal})</label>
                <div className="relative">
                  <input type="number" placeholder="0.00" className="w-full bg-white/5 border border-white/10 p-5 rounded-[1.5rem] font-bold focus:border-blue-500 outline-none" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                  <button onClick={() => setWithdrawAmount((displayBalance + liveMiningBonus).toFixed(6))} className="absolute right-4 top-4 bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600/40 transition-colors">Max</button>
                </div>
              </div>
              <button onClick={handleWithdrawRequest} disabled={isSubmitting} className="w-full bg-blue-600 py-6 rounded-[2rem] font-black uppercase tracking-[0.4em] shadow-xl shadow-blue-600/40 active:scale-95 transition-all text-[12px] flex items-center justify-center gap-3">
                {isSubmitting ? <><i className="fa-solid fa-circle-notch animate-spin"></i> TRANSMITTING...</> : "Initiate Payout"}
              </button>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-4">
              <h4 className="text-[10px] font-black text-gray-700 uppercase tracking-[0.3em] ml-2">Recent Transactions</h4>
              {withdrawHistory.length === 0 ? (
                <p className="text-center py-8 text-gray-800 font-black text-[9px] uppercase tracking-widest">No transaction data</p>
              ) : withdrawHistory.map((h: any) => (
                <div key={h.id} className="bg-white/5 p-5 rounded-[1.5rem] flex justify-between items-center border border-white/5 group hover:bg-white/[0.08] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm ${h.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : h.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                       <i className={`fa-solid ${h.status === 'completed' ? 'fa-check' : h.status === 'rejected' ? 'fa-x' : 'fa-clock'}`}></i>
                    </div>
                    <div>
                      <p className="font-black text-sm">-{h.amount} TON</p>
                      <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">{h.timestamp?.toDate()?.toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg border ${h.status === 'completed' ? 'border-emerald-500/20 text-emerald-500' : h.status === 'rejected' ? 'border-red-500/20 text-red-500' : 'border-yellow-500/20 text-yellow-500'}`}>
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* الهيدر مع المنطقة السرية المخفية تماماً */}
      <header className="px-6 py-5 flex justify-between items-center border-b border-white/5 backdrop-blur-lg relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-xl flex items-center justify-center text-white shadow-lg"><i className="fa-solid fa-microchip animate-pulse"></i></div>
          <h2 className="text-[11px] font-black uppercase tracking-widest">BeeClaimer <span className="text-blue-500">Pro</span></h2>
        </div>
        
        {/* زر سري مخفي تماماً - يتطلب 8 ضغطات متتالية */}
        <button 
          onClick={handleSecretClick} 
          className="w-12 h-12 rounded-xl bg-transparent opacity-0 cursor-default flex items-center justify-center transition-none"
          aria-hidden="true"
        >
          <i className="fa-solid fa-fingerprint"></i>
        </button>
      </header>

      <main className="flex-grow overflow-y-auto px-6 pb-36 pt-6 space-y-6">
        
        {activeTab === 'home' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-gradient-to-br from-blue-900/50 via-[#0c0c0c] to-[#050505] border border-blue-500/20 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
               <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]"></div>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Core Balance</p>
              <h1 className="text-6xl font-black tracking-tighter tabular-nums flex items-baseline gap-2 mb-8">
                {(displayBalance + liveMiningBonus).toFixed(8)} <span className="text-blue-500 text-lg">TON</span>
              </h1>
              <button onClick={() => setShowWithdrawModal(true)} className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-xl shadow-blue-600/40 active:scale-95 transition-all">Open Wallet</button>
            </div>

            <div className="bg-[#0c0c0c] border border-emerald-500/20 rounded-[2.5rem] p-7 flex flex-col gap-5 group relative overflow-hidden transition-all hover:border-emerald-500/40">
               {timeToFaucet !== 'Ready' && (
                 <div 
                   className="absolute bottom-0 left-0 h-1 bg-emerald-500/40 shadow-[0_0_10px_#10b981] transition-all duration-1000" 
                   style={{ width: `${faucetProgress}%` }}
                 ></div>
               )}
               <div className="flex items-center justify-between w-full">
                 <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 ${timeToFaucet === 'Ready' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 rotate-[360deg]' : 'bg-white/5 text-emerald-500/20'}`}><i className="fa-solid fa-faucet-drip"></i></div>
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Capped Yield</p>
                      <p className="text-2xl font-black text-white tabular-nums">{liveFaucetAccumulated.toFixed(6)}</p>
                    </div>
                 </div>
                 <button onClick={handleClaimFaucet} disabled={timeToFaucet !== 'Ready'} className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase transition-all duration-300 ${timeToFaucet === 'Ready' ? 'bg-white text-black active:scale-90 shadow-xl' : 'bg-white/5 text-gray-700'}`}>
                   {timeToFaucet === 'Ready' ? 'CLAIM' : timeToFaucet}
                 </button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'mining' && (
          <div className="flex flex-col items-center animate-in fade-in py-4">
             <MiningCircle hashRate={4210} coinName="TON" isMining={isMiningActive} miningReward={config.miningReward} timeToMining={timeToMining} currentLiveBonus={liveMiningBonus} />
             <button onClick={async () => {
               if (isMiningActive) return;
               await updateDoc(doc(db, "users", userId), { lastMining: Date.now() });
             }} disabled={isMiningActive} className={`w-full max-w-sm mt-12 py-7 rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.5em] transition-all ${!isMiningActive ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/30 active:scale-95' : 'bg-white/5 text-gray-700'}`}>
                {!isMiningActive ? 'IGNITE CLOUD MINER' : 'MINING PROCESS ACTIVE'}
             </button>
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-gradient-to-br from-pink-900/40 via-[#0c0c0c] to-[#050505] border border-pink-500/20 rounded-[3rem] p-10 text-center relative overflow-hidden group">
                <div className="w-20 h-20 bg-pink-600 rounded-[2rem] mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-pink-600/40 mb-8"><i className="fa-solid fa-users"></i></div>
                <h3 className="text-3xl font-black uppercase tracking-tight mb-2">Hive Collective</h3>
                <p className="text-pink-400 font-black text-[10px] uppercase tracking-[0.3em]">Yield {config.referralReward} TON per recruit</p>
                <button onClick={() => window.open(`https://t.me/share/url?url=https://t.me/${(window as any).Telegram?.WebApp?.initDataUnsafe?.bot_name || 'Bot'}?start=${userId}`)} className="w-full mt-10 bg-pink-600 py-6 rounded-[2rem] font-black text-[12px] uppercase tracking-widest shadow-xl shadow-pink-600/20 active:scale-95 transition-all">RECRUIT PEERS</button>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] text-center"><p className="text-[10px] text-gray-600 font-black uppercase mb-2">Active Peers</p><p className="text-4xl font-black">{userData?.referralCount || 0}</p></div>
               <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] text-center"><p className="text-[10px] text-gray-600 font-black uppercase mb-2">Total Yield</p><p className="text-4xl font-black text-pink-500">{(userData?.referralCount || 0 * config.referralReward).toFixed(4)}</p></div>
             </div>

             <div className="space-y-4">
               {referralsList.map((ref, i) => (
                 <div key={i} className="bg-white/5 p-6 rounded-3xl flex justify-between items-center border border-transparent hover:border-pink-500/10 transition-all">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-pink-500/10 text-pink-500 flex items-center justify-center rounded-2xl font-black text-sm">#{i+1}</div>
                      <p className="text-sm font-black">{ref.username || 'PEER'}</p>
                    </div>
                    <p className="text-xs font-black text-emerald-400">+{config.referralReward} TON</p>
                 </div>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-8 animate-in fade-in">
             {!isAdminAuthenticated ? (
               <div className="bg-[#0c0c0c] p-12 rounded-[3rem] border border-white/5 text-center shadow-2xl">
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-8">ADMIN ACCESS</h3>
                  <input type="password" placeholder="PIN" className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl mb-6 text-center text-2xl font-black tracking-[0.5em] outline-none" value={adminInputPass} onChange={(e) => setAdminInputPass(e.target.value)} />
                  <button onClick={() => adminInputPass === config.adminPass ? setIsAdminAuthenticated(true) : alert("WRONG PIN")} className="w-full bg-white text-black py-6 rounded-[2rem] font-black uppercase active:scale-95 transition-all">Authorize</button>
               </div>
             ) : (
               <div className="space-y-10">
                  <div className="bg-[#0c0c0c] p-8 rounded-[3rem] border border-blue-500/20">
                     <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-10 text-center border-b border-white/5 pb-4">Global System Settings</h4>
                     <div className="space-y-6">
                        {[
                          { key: 'faucetReward', label: 'Faucet Amount', step: 0.0001 },
                          { key: 'faucetIntervalHours', label: 'Faucet Time (Hours)', step: 1 },
                          { key: 'miningReward', label: 'Mining Reward', step: 0.0001 },
                          { key: 'miningIntervalHours', label: 'Mining Time (Hours)', step: 1 },
                          { key: 'referralReward', label: 'Referral Bonus', step: 0.0001 },
                          { key: 'minWithdrawal', label: 'Min Withdrawal', step: 0.001 }
                        ].map((field) => (
                          <div key={field.key} className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase text-gray-600 ml-2">{field.label}</label>
                            <input type="number" step={field.step} className="bg-white/5 border border-white/10 p-4 rounded-xl w-full font-black text-right outline-none focus:border-blue-500" value={(config as any)[field.key]} onChange={(e) => setConfig({...config, [field.key]: parseFloat(e.target.value)})} />
                          </div>
                        ))}
                        <div className="flex flex-col gap-2 pt-2">
                           <label className="text-[10px] font-black uppercase text-gray-600 ml-2">Adsgram Block ID</label>
                           <input type="text" className="bg-white/5 border border-white/10 p-4 rounded-xl font-bold outline-none focus:border-blue-500" value={config.adsgramBlockId} onChange={(e) => setConfig({...config, adsgramBlockId: e.target.value})} />
                        </div>
                        <button onClick={async () => { await setDoc(doc(db, "settings", "global"), config); alert("Updated"); }} className="w-full bg-blue-600 py-6 rounded-[2rem] font-black text-[12px] tracking-[0.4em] active:scale-95 shadow-xl shadow-blue-600/30">UPDATE CONFIG</button>
                     </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-yellow-500 uppercase tracking-widest ml-4">PENDING WITHDRAWALS</h4>
                    {allWithdrawals.filter(w => w.status === 'pending').map((w: any) => (
                      <div key={w.id} className="bg-[#0c0c0c] border border-white/5 p-8 rounded-[3rem] space-y-6 shadow-xl animate-in fade-in">
                         <div className="flex justify-between items-start">
                           <p className="text-3xl font-black">{w.amount} <span className="text-xs text-gray-600">TON</span></p>
                           <span className="bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border border-yellow-500/20">Pending</span>
                         </div>
                         <p className="text-xs text-blue-400 font-black break-all select-all bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">{w.address}</p>
                         <div className="grid grid-cols-2 gap-4">
                           <button onClick={async () => { await updateDoc(doc(db, "withdrawals", w.id), {status: 'completed'}); alert("Approved!"); }} className="bg-emerald-600/90 py-4 rounded-2xl font-black text-[11px]">APPROVE</button>
                           <button onClick={async () => { await updateDoc(doc(db, "withdrawals", w.id), {status: 'rejected'}); alert("Rejected"); }} className="bg-red-600/90 py-4 rounded-2xl font-black text-[11px]">REJECT</button>
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>
        )}

      </main>

      <nav className="fixed bottom-0 left-0 right-0 p-6 z-50">
        <div className="max-w-md mx-auto bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-2 flex justify-around shadow-2xl">
          {[
            { id: 'home', icon: 'fa-wallet', label: 'Vault' },
            { id: 'mining', icon: 'fa-microchip', label: 'Miner' },
            { id: 'friends', icon: 'fa-users', label: 'Hive' }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-4 rounded-[2rem] flex flex-col items-center gap-1.5 transition-all ${activeTab === tab.id ? 'bg-white text-black shadow-2xl scale-105' : 'text-gray-500'}`}>
              <i className={`fa-solid ${tab.icon} text-base`}></i>
              <span className="text-[9px] font-black uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <style>{`
        ::-webkit-scrollbar { display: none; }
        .animate-in { animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default App;
