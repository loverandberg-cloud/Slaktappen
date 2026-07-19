import React, { useState, useMemo } from 'react';
import { PlusCircle, List, Users, Calendar, Activity, Trash2, Scale, Download } from 'lucide-react';

// Säkrare hantering av lokal lagring
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      }
    } catch (error) {
      console.warn('Kunde inte läsa från localStorage, använder standardvärde.', error);
    }
    return initialValue;
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn('Kunde inte spara till localStorage.', error);
    }
  };

  return [storedValue, setValue];
}

// Skapar ett unikt ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

export default function App() {
  const [activeTab, setActiveTab] = useState('register');
  
  // Data state
  const [groups, setGroups] = useLocalStorage('slakt_groups', []);
  const [records, setRecords] = useLocalStorage('slakt_records', []);

  // Form states - Ny Grupp
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupBirthDate, setNewGroupBirthDate] = useState(new Date().toISOString().split('T')[0]);

  // Form states - Ny Slakt
  const [recordType, setRecordType] = useState('Höna');
  const [recordGroupId, setRecordGroupId] = useState('');
  const [recordSlaughterDate, setRecordSlaughterDate] = useState(new Date().toISOString().split('T')[0]);
  const [recordWeight, setRecordWeight] = useState('');

  // --- BERÄKNINGAR ---

  // Räkna ut ålder i dagar
  const calculateAgeDays = (birthDate, slaughterDate) => {
    if (!birthDate || !slaughterDate) return null;
    const b = new Date(birthDate);
    const s = new Date(slaughterDate);
    if (s < b) return -1;
    const diffTime = Math.abs(s - b);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Dynamisk ålder för inmatningsformuläret
  const currentAge = useMemo(() => {
    const group = groups.find(g => g.id === recordGroupId);
    if (group && recordSlaughterDate) {
      return calculateAgeDays(group.birthDate, recordSlaughterDate);
    }
    return null;
  }, [recordGroupId, recordSlaughterDate, groups]);

  // Total slaktvikt för alla registreringar
  const totalWeightAll = useMemo(() => {
    return records.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
  }, [records]);

  // Total slaktvikt per ID/Grupp
  const weightPerGroup = useMemo(() => {
    return records.reduce((acc, r) => {
      const w = parseFloat(r.weight) || 0;
      if (w > 0) {
        if (!acc[r.groupId]) acc[r.groupId] = 0;
        acc[r.groupId] += w;
      }
      return acc;
    }, {});
  }, [records]);

  // --- FUNKTIONER ---

  const handleAddGroup = (e) => {
    e.preventDefault();
    if (!newGroupId || !newGroupBirthDate) return;
    
    if (groups.some(g => g.id === newGroupId)) {
      alert("En grupp med detta ID finns redan.");
      return;
    }

    setGroups([...groups, { id: newGroupId, birthDate: newGroupBirthDate }]);
    setNewGroupId('');
    if (!recordGroupId) setRecordGroupId(newGroupId);
  };

  const handleDeleteGroup = (id) => {
    if (window.confirm('Är du säker på att du vill radera denna grupp? Inga slaktregistreringar försvinner, men kopplingen till födelsedatumet tas bort.')) {
      setGroups(groups.filter(g => g.id !== id));
      if (recordGroupId === id) setRecordGroupId('');
    }
  };

  const handleAddRecord = (e) => {
    e.preventDefault();
    if (!recordGroupId || !recordSlaughterDate) {
      alert("Välj grupp och slaktdatum.");
      return;
    }
    if (currentAge !== null && currentAge < 0) {
      alert("Slaktdatum kan inte vara innan födelsedatumet.");
      return;
    }

    const newRecord = {
      id: generateId(),
      type: recordType,
      groupId: recordGroupId,
      slaughterDate: recordSlaughterDate,
      ageDays: currentAge,
      weight: recordWeight,
      createdAt: new Date().toISOString()
    };

    setRecords([newRecord, ...records]);
    setRecordWeight(''); // Nollställ bara vikten för snabbare inmatning
    alert("Slakt sparad!");
  };

  const handleDeleteRecord = (id) => {
    if (window.confirm('Radera denna registrering?')) {
      setRecords(records.filter(r => r.id !== id));
    }
  };

  // --- EXPORT FUNKTION ---
  const handleExportCSV = () => {
    if (records.length === 0) {
      alert("Det finns ingen data att exportera.");
      return;
    }

    // Skapa CSV-headers
    let csvContent = "Datum Registrerad,Djurslag,Grupp ID,Slaktdatum,Ålder (dagar),Vikt (kg)\n";

    // Lägg till datan
    records.forEach(record => {
      const dateRegistered = new Date(record.createdAt).toLocaleDateString();
      const row = [
        dateRegistered,
        record.type,
        record.groupId,
        record.slaughterDate,
        record.ageDays,
        record.weight || '0'
      ].join(",");
      csvContent += row + "\n";
    });

    // Skapa och ladda ner filen
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `slaktstatistik_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800 font-sans pb-20">
      
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity size={24} />
          Slaktstatistik
        </h1>
      </header>

      {/* Huvudinnehåll */}
      <main className="flex-grow p-4 max-w-md mx-auto w-full">
        
        {/* FLIK 1: REGISTRERA SLAKT */}
        {activeTab === 'register' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Ny registrering</h2>
            
            {groups.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl flex flex-col items-center text-center gap-3">
                <Users size={40} className="text-amber-400" />
                <p className="font-medium">Lägg till en Grupp/Kull först!</p>
                <p className="text-sm">Du måste veta födelsedatumet innan du kan registrera slakten.</p>
                <button 
                  onClick={() => setActiveTab('groups')}
                  className="mt-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold transition w-full shadow-sm"
                >
                  Skapa en grupp
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddRecord} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-5">
                
                {/* Djurslag */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-600">Djurslag</label>
                  <div className="relative">
                    <select 
                      value={recordType}
                      onChange={(e) => setRecordType(e.target.value)}
                      className="w-full p-3.5 pl-12 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none font-medium text-lg"
                    >
                      <option value="Höna">Höna</option>
                      <option value="Kanin">Kanin</option>
                    </select>
                    <div className="absolute left-4 top-3.5 text-xl">
                      {recordType === 'Höna' ? '🐔' : '🐰'}
                    </div>
                  </div>
                </div>

                {/* Grupp / ID */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-600">Grupp / Märkning</label>
                  <select 
                    value={recordGroupId}
                    onChange={(e) => setRecordGroupId(e.target.value)}
                    required
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                  >
                    <option value="" disabled>Välj från listan...</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>
                        ID: {g.id} (Född: {g.birthDate})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Slaktdatum */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-600">Slaktdatum</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={recordSlaughterDate}
                      onChange={(e) => setRecordSlaughterDate(e.target.value)}
                      required
                      className="w-full p-3.5 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    />
                    <Calendar size={20} className="absolute left-3.5 top-4 text-gray-400" />
                  </div>
                </div>

                {/* Automatisk åldersuträkning */}
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider mb-1">Slaktålder</p>
                    <p className="text-3xl font-extrabold text-emerald-900">
                      {currentAge === null ? '-' : currentAge < 0 ? 'Ogiltig' : `${currentAge} dgr`}
                    </p>
                    {currentAge !== null && currentAge >= 0 && (
                      <p className="text-sm text-emerald-700 font-medium">
                        (ca {Math.floor(currentAge / 7)} veckor)
                      </p>
                    )}
                  </div>
                  <Activity size={40} className="text-emerald-200" />
                </div>

                {/* Vikt */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-600">Vikt i kg (frivilligt)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="t.ex. 2.4"
                      value={recordWeight}
                      onChange={(e) => setRecordWeight(e.target.value)}
                      className="w-full p-3.5 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    />
                    <Scale size={20} className="absolute left-3.5 top-4 text-gray-400" />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <PlusCircle size={22} />
                  Spara Slakt
                </button>
              </form>
            )}
          </div>
        )}

        {/* FLIK 2: GRUPPER */}
        {activeTab === 'groups' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Märkningar & Kullar</h2>
            <p className="text-gray-600 text-sm">
              Skapa grupper här först så räknas åldern ut automatiskt vid slakt.
            </p>
            
            <form onSubmit={handleAddGroup} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-600">Märkning / ID</label>
                <input 
                  type="text" 
                  placeholder="t.ex. 1, 2, eller Kull A"
                  value={newGroupId}
                  onChange={(e) => setNewGroupId(e.target.value)}
                  required
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-600">Födelsedatum</label>
                <input 
                  type="date" 
                  value={newGroupBirthDate}
                  onChange={(e) => setNewGroupBirthDate(e.target.value)}
                  required
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <PlusCircle size={22} />
                Lägg till Grupp
              </button>
            </form>

            <div className="space-y-3 mt-8">
              <h3 className="font-bold text-gray-800 border-b pb-2">Dina Grupper ({groups.length})</h3>
              
              {groups.map((group) => {
                const groupWeight = weightPerGroup[group.id] || 0;
                
                return (
                  <div key={group.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div>
                      <p className="font-extrabold text-lg text-gray-800">ID: {group.id}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                        <Calendar size={14}/> Född: {group.birthDate}
                      </p>
                      {groupWeight > 0 && (
                        <p className="text-sm text-emerald-600 font-bold flex items-center gap-1.5 mt-1">
                          <Scale size={14}/> Total slaktvikt: {parseFloat(groupWeight.toFixed(2))} kg
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition"
                    >
                      <Trash2 size={22} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FLIK 3: HISTORIK & STATISTIK */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Historik & Statistik</h2>
            
            {/* Sammanställning / Statistikruta */}
            <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-sm relative">
              <h3 className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Total Slaktvikt (Allt)</h3>
              <p className="text-4xl font-extrabold mb-4">
                {totalWeightAll > 0 ? `${parseFloat(totalWeightAll.toFixed(2))} kg` : '0 kg'}
              </p>
              
              {Object.keys(weightPerGroup).length > 0 && (
                <div className="border-t border-emerald-500 pt-3">
                  <h4 className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-2">Totalvikt per ID</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(weightPerGroup).map(([id, weight]) => (
                      <div key={id} className="bg-emerald-700/50 px-3 py-1.5 rounded-lg text-sm border border-emerald-500/30">
                        <span className="font-medium text-emerald-100">ID {id}:</span> <span className="font-bold">{parseFloat(weight.toFixed(2))} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Exportknapp */}
            <button 
              onClick={handleExportCSV}
              className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold p-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Download size={20} />
              Exportera till Kalkylark (.csv)
            </button>

            <div className="space-y-3 mt-4">
              <h3 className="font-bold text-gray-800 border-b pb-2">Senaste slakt ({records.length})</h3>

              {records.length === 0 && (
                <div className="text-center p-10 bg-white rounded-2xl border border-gray-100 mt-4">
                  <List size={48} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-gray-500 font-medium">Ingen slakt registrerad än.</p>
                </div>
              )}

              {records.map((record) => (
                <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl bg-gray-50 p-2 rounded-xl border border-gray-100">
                        {record.type === 'Höna' ? '🐔' : '🐰'}
                      </div>
                      <div>
                        <p className="font-extrabold text-gray-800 text-lg">
                          {record.type} <span className="text-gray-300 font-normal mx-1">|</span> ID: {record.groupId}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-1.5">
                          <Calendar size={14}/> Slakt: {record.slaughterDate}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteRecord(record.id)}
                      className="text-gray-300 hover:text-red-500 p-2"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  
                  <div className="flex gap-6 mt-1 pt-3 border-t border-gray-50">
                    <div>
                      <p className="text-[11px] text-emerald-600 uppercase font-bold tracking-wider mb-0.5">Slaktålder</p>
                      <p className="font-bold text-gray-800">{record.ageDays} dagar</p>
                    </div>
                    {record.weight && (
                      <div>
                        <p className="text-[11px] text-blue-600 uppercase font-bold tracking-wider mb-0.5">Vikt</p>
                        <p className="font-bold text-gray-800">{record.weight} kg</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Bottenmeny (Mobil) */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-20">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          <button 
            onClick={() => setActiveTab('groups')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'groups' ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <Users size={24} />
            <span className="text-[11px] font-bold">Grupper</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('register')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'register' ? 'text-emerald-600' : 'text-gray-400'}`}
          >
            <PlusCircle size={24} />
            <span className="text-[11px] font-bold">Ny Slakt</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'history' ? 'text-gray-800' : 'text-gray-400'}`}
          >
            <List size={24} />
            <span className="text-[11px] font-bold">Historik</span>
          </button>
        </div>
      </nav>
      
    </div>
  );
}
