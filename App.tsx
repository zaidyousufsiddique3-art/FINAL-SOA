import React, { useState, useMemo, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { ManualEntryForm } from './components/ManualEntryForm';
import { Transaction, StatementConfig, StatementHistoryItem } from './types';
import { generateStatementPDF } from './services/pdfGenerator';
import { FileText, Users, Download, Trash2, Activity, History, LayoutTemplate, LogOut, Loader2, Save, CheckCircle, CreditCard } from 'lucide-react';
import { formatDate } from './utils/formatters';
import { Login } from './components/Login';
import { auth, db, storage } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { COMPANY_LOGO_BASE64 } from './constants/logo';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'generator' | 'history'>('generator');
  const [fileTransactions, setFileTransactions] = useState<Transaction[]>([]);
  const [manualTransactions, setManualTransactions] = useState<Transaction[]>([]);
  const [history, setHistory] = useState<StatementHistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [logoData, setLogoData] = useState<string | null>(COMPANY_LOGO_BASE64);
  
  const [config, setConfig] = useState<Omit<StatementConfig, 'logoUrl'>>({
    operatingUnit: 'FMCG',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    openingBalance: 0,
  });

  const [configSaved, setConfigSaved] = useState(false);

  // Authentication & History Loading
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (currentUser) {
        // Load history from Firestore
        const q = query(
          collection(db, `users/${currentUser.uid}/statements`), 
          orderBy('createdAt', 'desc')
        );
        
        const unsubHistory = onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              customerName: data.customerName,
              period: data.period,
              fileName: data.fileName,
              blobUrl: data.blobUrl,
              generatedAt: data.createdAt?.toDate() || new Date()
            } as StatementHistoryItem;
          });
          setHistory(items);
        });
        
        return () => unsubHistory();
      } else {
        setHistory([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load local logo override if exists (optional feature), otherwise default to constant
  useEffect(() => {
    const savedLogo = localStorage.getItem('companyLogo');
    if (savedLogo) {
      setLogoData(savedLogo);
    } else {
      setLogoData(COMPANY_LOGO_BASE64);
    }
  }, []);

  // Extract unique customers from uploaded file
  const customers = useMemo(() => {
    const names = new Set(fileTransactions.map(t => t.customerName).filter(Boolean));
    return Array.from(names).sort();
  }, [fileTransactions]);

  const handleDataLoaded = (data: Transaction[]) => {
    setFileTransactions(prev => [...prev, ...data]);
  };

  const handleManualAdd = (trx: Transaction) => {
    setManualTransactions(prev => [...prev, trx]);
  };

  const handleManualDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this payment entry?")) {
      setManualTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setLogoData(result);
        localStorage.setItem('companyLogo', result);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleClearData = () => {
    if (confirm("Are you sure you want to clear all data? This will reset the logo to default.")) {
      setFileTransactions([]);
      setManualTransactions([]);
      setSelectedCustomer('');
      setConfigSaved(false);
      setLogoData(COMPANY_LOGO_BASE64);
      localStorage.removeItem('companyLogo');
    }
  };

  const handleSaveConfig = () => {
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);
  };

  const handleGeneratePDF = async () => {
    if (!selectedCustomer) return alert('Please select a customer.');
    if (!user) return alert('You must be logged in to generate statements.');
    
    setIsGenerating(true);

    try {
      // 1. Generate PDF locally
      const { blob, fileName } = generateStatementPDF(
        fileTransactions,
        manualTransactions,
        selectedCustomer,
        {
          ...config,
          logoUrl: logoData
        }
      );

      // 2. Upload to Firebase Storage
      const storageRef = ref(storage, `statements/${user.uid}/${fileName}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      // 3. Save Metadata to Firestore
      await addDoc(collection(db, `users/${user.uid}/statements`), {
        customerName: selectedCustomer,
        period: `${formatDate(config.startDate)} - ${formatDate(config.endDate)}`,
        fileName,
        blobUrl: downloadURL,
        createdAt: serverTimestamp(),
        config: { ...config }
      });

    } catch (error) {
      console.error("Error saving statement:", error);
      alert("Failed to save statement to cloud.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#14F1E1]" size={48} />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E5E7EB] font-sans selection:bg-[#14F1E1] selection:text-black">
      {/* Navbar */}
      <nav className="bg-[#16181D] border-b border-[#2A2D33] px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-lg shadow-black/40">
        <div className="flex items-center gap-3">
          <div className="bg-[#14F1E1] bg-opacity-10 border border-[#14F1E1] p-2 rounded-lg text-[#14F1E1] shadow-[0_0_10px_rgba(20,241,225,0.2)]">
            <Activity size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            AI <span className="text-[#14F1E1]">STATEMENT</span> GEN
          </h1>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={handleClearData} className="text-[#E5E7EB] text-xs hover:text-red-400 transition-colors flex items-center gap-2 px-3 py-1.5 rounded hover:bg-white/5">
             <Trash2 size={14} /> Clear Data
           </button>
           <div className="h-6 w-px bg-[#2A2D33]"></div>
           <span className="text-xs text-gray-500 hidden md:inline">{user.email}</span>
           <button onClick={handleLogout} className="bg-[#2A2D33] hover:bg-red-500/10 hover:text-red-400 text-white p-2 rounded-lg transition-colors" title="Logout">
             <LogOut size={18} />
           </button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <div className="flex gap-1 bg-[#16181D] p-1 rounded-lg border border-[#2A2D33] w-fit">
          <button 
            onClick={() => setActiveTab('generator')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'generator' ? 'bg-[#2A2D33] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <LayoutTemplate size={16} /> Generator
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-[#2A2D33] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <History size={16} /> History
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-8">
        
        {/* GENERATOR TAB */}
        {activeTab === 'generator' && (
          <>
            {/* Step 1: Data Source */}
            <section className="bg-[#16181D] p-6 rounded-xl border border-[#2A2D33] shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#14F1E1]"></div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#A1A5B0] mb-6 flex items-center gap-2">
                <FileText size={16} className="text-[#14F1E1]" /> Step 1: Data Source
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <FileUpload onDataLoaded={handleDataLoaded} />
                
                <div className="bg-[#0B0C10] border border-[#2A2D33] rounded-lg px-4 py-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-medium text-[#A1A5B0] uppercase">Company Logo</label>
                    {logoData && <span className="text-[10px] text-green-400 font-bold flex items-center gap-1"><CheckCircle size={10} /> Active</span>}
                  </div>
                  
                  {logoData ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-white p-2 rounded-lg max-w-[150px]">
                        <img src={logoData} alt="Logo Preview" className="w-full h-auto object-contain" />
                      </div>
                      <button 
                         onClick={() => { setLogoData(COMPANY_LOGO_BASE64); localStorage.removeItem('companyLogo'); }}
                         className="text-[10px] text-red-400 hover:underline"
                      >
                        Reset to Default Logo
                      </button>
                    </div>
                  ) : (
                    <>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoUpload} 
                        className="block w-full text-xs text-gray-400
                          file:mr-3 file:py-2 file:px-3
                          file:rounded file:border-0
                          file:text-xs file:font-semibold
                          file:bg-[#2A2D33] file:text-[#14F1E1]
                          hover:file:bg-[#343840]
                          cursor-pointer"
                      />
                      <p className="text-[10px] text-gray-600 mt-2">Upload custom logo or use default.</p>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* Step 2: Payment Transactions */}
            <section className="bg-[#16181D] p-6 rounded-xl border border-[#2A2D33] shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#5B6CFF]"></div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#A1A5B0] mb-6 flex items-center gap-2">
                    <CreditCard size={16} className="text-[#5B6CFF]" /> Step 2: Payment Transactions
                </h2>
                <ManualEntryForm 
                  onAddTransaction={handleManualAdd}
                  onDeleteTransaction={handleManualDelete}
                  customers={customers} 
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={setSelectedCustomer}
                  manualTransactions={manualTransactions}
                />
            </section>

            {/* Step 3: Statement Config */}
            <section className="bg-[#16181D] p-6 rounded-xl border border-[#2A2D33] shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#14F1E1]"></div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#A1A5B0] mb-6 flex items-center gap-2">
                <Users size={16} className="text-[#14F1E1]" /> Step 3: Statement Configuration
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-[#A1A5B0] mb-1 uppercase tracking-wide">Target Customer</label>
                  <input 
                    type="text" 
                    value={selectedCustomer || "No Customer Selected"} 
                    disabled 
                    className="w-full bg-[#0B0C10] border border-[#2A2D33] text-gray-400 rounded-lg p-3 cursor-not-allowed font-medium"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">* Auto-selected from Payment Transactions section</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative">
                      <label className="block text-xs text-[#A1A5B0] mb-1 flex items-center gap-1 uppercase font-semibold"> From Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-[#0B0C10] border border-[#2A2D33] text-white rounded p-3 text-sm outline-none focus:border-[#14F1E1]" 
                        value={config.startDate} 
                        onChange={e => setConfig({...config, startDate: e.target.value})} 
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-xs text-[#A1A5B0] mb-1 flex items-center gap-1 uppercase font-semibold"> To Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-[#0B0C10] border border-[#2A2D33] text-white rounded p-3 text-sm outline-none focus:border-[#14F1E1]" 
                        value={config.endDate} 
                        onChange={e => setConfig({...config, endDate: e.target.value})} 
                      />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                    <label className="block text-xs text-[#A1A5B0] mb-1 flex items-center gap-1 uppercase font-semibold"> Opening Balance</label>
                    <input 
                        type="number" 
                        className="w-full bg-[#0B0C10] border border-[#2A2D33] text-white rounded p-3 text-sm outline-none focus:border-[#14F1E1]" 
                        value={config.openingBalance} 
                        onChange={e => setConfig({...config, openingBalance: parseFloat(e.target.value) || 0})}
                        placeholder="0.00"
                    />
                    </div>
                    <div>
                        <label className="block text-xs text-[#A1A5B0] mb-1 uppercase font-semibold">Operating Unit</label>
                        <input 
                        type="text" 
                        className="w-full bg-[#0B0C10] border border-[#2A2D33] text-white rounded p-3 text-sm outline-none focus:border-[#14F1E1]" 
                        value={config.operatingUnit} 
                        onChange={e => setConfig({...config, operatingUnit: e.target.value})} 
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleSaveConfig}
                    className="bg-[#2A2D33] text-white border border-gray-600 px-6 py-2 rounded-lg text-sm font-bold hover:bg-gray-700 transition-all flex items-center gap-2"
                  >
                    <Save size={16} />
                    Save Configuration
                  </button>
                  {configSaved && (
                    <div className="flex items-center gap-2 text-green-400 animate-in fade-in slide-in-from-left-2">
                      <CheckCircle size={16} />
                      <span className="text-xs font-bold">Configuration Saved!</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Generate Button */}
            <button 
              onClick={handleGeneratePDF}
              disabled={!selectedCustomer || isGenerating}
              className="w-full bg-[#14F1E1] hover:bg-[#0FF4C6] disabled:bg-[#2A2D33] disabled:text-gray-500 text-[#0B0C10] py-4 rounded-xl font-bold text-lg shadow-[0_0_15px_rgba(20,241,225,0.3)] hover:shadow-[0_0_25px_rgba(20,241,225,0.5)] transition-all flex items-center justify-center gap-2 transform active:scale-[0.99]"
            >
              {isGenerating ? (
                <>
                   <Loader2 size={22} className="animate-spin" />
                   SAVING & GENERATING...
                </>
              ) : (
                <>
                  <Download size={22} />
                  GENERATE FINAL STATEMENT PDF
                </>
              )}
            </button>
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <section className="bg-[#16181D] p-6 rounded-xl border border-[#2A2D33] shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#A1A5B0]"></div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#A1A5B0] mb-6 flex items-center gap-2">
              <History size={16} className="text-[#E5E7EB]" /> Generated Statements History
            </h2>
            
            {history.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                 <History size={48} className="mx-auto mb-4 opacity-20" />
                 <p className="text-sm">No statements generated yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#2A2D33] rounded-lg">
                <table className="w-full text-left text-xs text-gray-400">
                  <thead className="bg-[#0B0C10] text-gray-200">
                     <tr>
                       <th className="p-4 font-medium">Generated At</th>
                       <th className="p-4 font-medium">Customer</th>
                       <th className="p-4 font-medium">Period</th>
                       <th className="p-4 font-medium text-right">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2D33] bg-[#16181D]">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-[#1C1F24]">
                        <td className="p-4">{item.generatedAt.toLocaleString()}</td>
                        <td className="p-4 text-white font-medium">{item.customerName}</td>
                        <td className="p-4">{item.period}</td>
                        <td className="p-4 text-right">
                          <a 
                            href={item.blobUrl} 
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 bg-[#2A2D33] hover:bg-[#14F1E1] hover:text-black text-white px-3 py-1.5 rounded transition-colors font-bold text-[10px] uppercase tracking-wide border border-gray-600 hover:border-[#14F1E1]"
                          >
                            <Download size={14} /> Download
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
};

export default App;