"use client";
import React, { useState, useMemo } from 'react';
import axios from 'axios';

// --- Helper Components (No changes) ---
const TileIcon = ({ type, value, isRed }) => {
     const baseStyle = "font-bold text-lg select-none"; 
     if (isRed) return <span className={`${baseStyle} text-red-500`}>{value}</span>; 
     switch (type) { 
        case 'm': return <span className={`${baseStyle} text-gray-800`}>{value}</span>; 
        case 'p': return <span className={`${baseStyle} text-blue-600`}>{value}</span>; 
        case 's': return <span className={`${baseStyle} text-green-600`}>{value}</span>; 
        case 'z': 
            const jihai = ['東', '南', '西', '北', '白', '發', '中']; 
            return <span className={`${baseStyle} text-gray-800`}>{jihai[value - 1]}</span>; 
        default: return null; } };
const Tile = ({ tile, onClick, isHandTile = false, isWinningTile = false }) => { 
    const redDoraClass = tile?.isRed ? 'border-red-500 shadow-red-300/50' : 'border-gray-300'; 
    const winningTileClass = isWinningTile ? 'ring-4 ring-offset-2 ring-blue-500 shadow-lg' : ''; 
    const tileStyle = `w-12 h-16 md:w-14 md:h-20 bg-white border-2 rounded-md flex items-center justify-center shadow-md transition-all duration-200 ${isHandTile ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''} ${redDoraClass} ${winningTileClass}`; return ( <div className={tileStyle} onClick={onClick}> {tile ? <TileIcon type={tile.type} value={tile.value} isRed={tile.isRed} /> : null} </div> ); };
const MeldModal = ({ type, onAddMeld, onClose }) => { const TILE_DATA = useMemo(() => ({ man: Array.from({ length: 9 }, (_, i) => ({ type: 'm', value: i + 1 })), pin: Array.from({ length: 9 }, (_, i) => ({ type: 'p', value: i + 1 })), sou: Array.from({ length: 9 }, (_, i) => ({ type: 's', value: i + 1 })), jihai: Array.from({ length: 7 }, (_, i) => ({ type: 'z', value: i + 1 })), }), []); const getSelectableTiles = () => { const allTiles = [...TILE_DATA.man, ...TILE_DATA.pin, ...TILE_DATA.sou, ...TILE_DATA.jihai]; if (type === 'chi') { return [...TILE_DATA.man, ...TILE_DATA.pin, ...TILE_DATA.sou].filter(t => t.value <= 7); } return allTiles; }; const handleTileSelect = (tile) => { let newMeld; switch (type) { case 'pon': newMeld = { type, tiles: [tile, tile, tile] }; break; case 'chi': newMeld = { type, tiles: [tile, { ...tile, value: tile.value + 1 }, { ...tile, value: tile.value + 2 }] }; break; case 'kan': newMeld = { type, tiles: [tile, tile, tile, tile] }; break; default: return; } onAddMeld(newMeld); }; return ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"> <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"> <div className="p-4 border-b flex justify-between items-center"> <h3 className="text-xl font-bold text-gray-800"> {type === 'pon' && 'ポンする牌を選択'} {type === 'chi' && 'チーする最初の牌を選択'} {type === 'kan' && 'カンする牌を選択'} </h3> <button onClick={onClose} className="text-gray-500 hover:text-gray-800 font-bold text-2xl">&times;</button> </div> <div className="p-4 overflow-y-auto"> <div className="grid grid-cols-5 sm:grid-cols-9 gap-2"> {getSelectableTiles().map(t => ( <button key={`${t.type}${t.value}`} onClick={() => handleTileSelect(t)} className="w-12 h-16 md:w-14 md:h-20 bg-white border-2 border-gray-300 rounded-md flex items-center justify-center shadow-md hover:border-blue-500"> <TileIcon type={t.type} value={t.value} /> </button> ))} </div> </div> </div> </div> ); };
// Custom Radio Button Component for styling
const CustomRadio = ({ label, name, value, checked, onChange }) => (
    <label className="cursor-pointer">
        <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="hidden" />
        <div className={`px-4 py-2 rounded-lg text-center font-semibold transition-colors ${checked ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
            {label}
        </div>
    </label>
);


// --- Main App Component ---
export default function MahjongInput() {
    const [hand, setHand] = useState([]);
    const [furo, setFuro] = useState([]);
    const [winTile, setWinTile] = useState(null);
    const [activeTab, setActiveTab] = useState('man');
    const [modalState, setModalState] = useState({ isOpen: false, type: null });
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // NEW: State for game conditions
    const [isTsumo, setIsTsumo] = useState(false);
    const [riichiState, setRiichiState] = useState(0); // 0: none, 1: riichi, 2: double riichi
    const [roundWind, setRoundWind] = useState('east'); // 'east', 'south'
    const [playerWind, setPlayerWind] = useState('east');

    const furoTilesCount = useMemo(() => furo.reduce((sum, meld) => sum + meld.tiles.length, 0), [furo]);
    const totalTiles = useMemo(() => hand.length + furoTilesCount, [hand, furoTilesCount]);
    const TILE_DATA = useMemo(() => ({ 
        man: Array.from({ length: 9 }, (_, i) => ({ type: 'm', value: i + 1 })), 
        pin: Array.from({ length: 9 }, (_, i) => ({ type: 'p', value: i + 1 })), 
        sou: Array.from({ length: 9 }, (_, i) => ({ type: 's', value: i + 1 })), 
        jihai: Array.from({ length: 7 }, (_, i) => ({ type: 'z', value: i + 1 })), 
    }), []);

    const addTileToHand = (tile) => { 
        if (totalTiles < 14) { 
            setHand([...hand, { ...tile, id: Date.now() + Math.random(), isRed: false }]); 
        } 
    };
    const handleHandTileClick = (clickedTile) => { 
        if (totalTiles === 14) { 
            setWinTile(winTile?.id === clickedTile.id ? null : clickedTile); 
        } else { setHand(hand.filter(t => t.id !== clickedTile.id)); } 
    };

    const addMeld = (meld) => {
         const meldTilesCount = meld.tiles.length; 
         if (hand.length + furoTilesCount + meldTilesCount > 14 || furo.length >= 4) { 
            alert("これ以上副露できません（手牌＋副露は合計14枚まで）"); 
            setModalState({ isOpen: false, type: null }); 
            return; 
        } 
        setFuro([...furo, { ...meld, id: Date.now() + Math.random() }]); 
        setModalState({ isOpen: false, type: null }); 
    };
    const removeMeld = (meldId) => { 
        setFuro(furo.filter(f => f.id !== meldId)); 
    };
    const sortHand = () => { 
        const typeOrder = { 'm': 1, 'p': 2, 's': 3, 'z': 4 }; 
        const sortedHand = [...hand].sort((a, b) => { 
            const typeComparison = typeOrder[a.type] - typeOrder[b.type]; 
            if (typeComparison !== 0) return typeComparison; 
            return a.value - b.value; }); 
            setHand(sortedHand); 
        };

    const handleCalculate = async () => {
        if (!winTile) { 
            alert("和了牌を選択してください。"); 
            return; 
        }
        setIsLoading(true);
        setResult(null);

        const apiHand = hand.map(({ id, ...rest }) => (rest));
        const apiFuro = furo.map(({ id, ...meld }) => ({ ...meld, tiles: meld.tiles.map(({ id, ...tile }) => (tile)) }));
        const apiWinTile = { type: winTile.type, value: winTile.value, isRed: winTile.isRed };

        try {
            const response = await axios.post('http://127.0.0.1:8000/calculate', {
                hand: apiHand,
                furo: apiFuro,
                win_tile: apiWinTile,
                // NEW: Send game state
                is_tsumo: isTsumo,
                riichi_state: riichiState,
                round_wind: roundWind,
                player_wind: playerWind,
            });
            setResult(response.data);
        } catch (error) {
            console.error("API Error:", error);
            setResult({ error: "計算サーバーとの通信に失敗しました。" });
        } finally {
            setIsLoading(false);
        }
    };
    
    const instructionText = totalTiles === 14 
    ? "手牌から和了牌をクリックして選択" 
    : `あと${14 - totalTiles}枚入力してください`;

    return (
        <div className="bg-gray-100 min-h-screen p-4 md:p-8 flex flex-col font-sans">
            {modalState.isOpen && ( 
                <MeldModal 
                type={modalState.type} 
                onAddMeld={addMeld} 
                onClose={() => setModalState({ isOpen: false, type: null })}
                /> 
            )}

            <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-lg flex flex-col flex-grow">
                {/* --- Hand & Furo Display Area --- */}
                <div className="p-4 md:p-6 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold text-gray-700">手牌</h2>
                        <span className="font-semibold text-blue-600">{instructionText}</span>
                        <div className="flex items-center gap-4">
                            <button onClick={sortHand} className="text-sm font-semibold text-blue-600 hover:text-blue-800" disabled={hand.length === 0}>並び替え</button>
                            <button onClick={() => {setHand([]); setFuro([]); setWinTile(null); setResult(null);}} className="text-sm text-gray-500 hover:text-red-600">全てクリア</button>
                        </div>
                    </div>
                    <div className="bg-green-800 p-3 rounded-lg flex flex-wrap gap-2 min-h-[100px]">
                        {furo.map(meld => ( 
                            <div key={meld.id} className="flex gap-1 border-r-4 border-green-700 pr-2 cursor-pointer" onClick={() => removeMeld(meld.id)} title="クリックして削除"> 
                            {meld.tiles.map((tile, i) => <Tile key={i} tile={tile} />)} 
                            </div> 
                        ))}
                        {hand.map((tile) => ( 
                            <Tile 
                            key={tile.id} 
                            tile={tile} 
                            onClick={() => handleHandTileClick(tile)} 
                            isHandTile={true} 
                            isWinningTile={winTile?.id === tile.id} 
                        /> 
                    ))}
                    </div>
                </div>
                
                {/* --- Meld Creation & Tile Selection (unchanged visually) --- */}
                <div className="p-4 md:px-6 border-b"> 
                <h2 className="text-xl font-bold text-gray-700 mb-3">副露（フーロ）を追加</h2> 
                <div className="flex gap-3"> 
                    <button onClick={() => setModalState({isOpen: true, type: 'pon'})} className="bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-600" disabled={totalTiles >= 14}>ポン</button> 
                    <button onClick={() => setModalState({isOpen: true, type: 'chi'})} className="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600" disabled={totalTiles >= 14}>チー</button> 
                    <button onClick={() => setModalState({isOpen: true, type: 'kan'})} className="bg-red-500 text-white font-bold py-2 px-4 rounded hover:bg-red-600" disabled={totalTiles >= 14}>カン</button> 
                </div> 
                </div>
                <div className="flex-grow flex flex-col p-4 md:p-6"> <div className="flex border-b border-gray-200 mb-4"> {[{id:"man",name:"萬子"},{id:"pin",name:"筒子"},{id:"sou",name:"索子"},{id:"jihai",name:"字牌"}].map(tab => ( <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-2 px-4 md:px-6 font-semibold text-lg ${activeTab === tab.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>{tab.name}</button> ))} </div> <div className="flex-grow bg-gray-50 p-4 rounded-b-lg"> <div className="grid grid-cols-5 sm:grid-cols-9 gap-2"> {TILE_DATA[activeTab].map(tile => ( <button key={`${tile.type}${tile.value}`} onClick={() => addTileToHand(tile)} disabled={totalTiles >= 14} className="w-12 h-16 md:w-14 md:h-20 bg-white border-2 border-gray-300 rounded-md flex items-center justify-center shadow-md hover:border-blue-500 disabled:opacity-50"><TileIcon type={tile.type} value={tile.value}/></button> ))} </div> </div> </div>
                
                {/* --- Game State Options --- */}
                <div className="p-4 md:p-6 border-t">
                    <h3 className="text-xl font-bold text-gray-700 mb-4">状況設定</h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="font-semibold text-gray-700 w-20">和了方法</span>
                            <div className="flex gap-2">
                                <CustomRadio label="ロン" name="winType" value="ron" checked={!isTsumo} onChange={() => setIsTsumo(false)} />
                                <CustomRadio label="ツモ" name="winType" value="tsumo" checked={isTsumo} onChange={() => setIsTsumo(true)} />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-semibold text-gray-700 w-20">リーチ</span>
                            <div className="flex gap-2">
                                <CustomRadio label="なし" name="riichi" value="0" checked={riichiState === 0} onChange={() => setRiichiState(0)} />
                                <CustomRadio label="リーチ" name="riichi" value="1" checked={riichiState === 1} onChange={() => setRiichiState(1)} />
                                <CustomRadio label="ダブル" name="riichi" value="2" checked={riichiState === 2} onChange={() => setRiichiState(2)} />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-semibold text-gray-700 w-20">場風</span>
                            <div className="flex gap-2">
                                <CustomRadio label="東" name="roundWind" value="east" checked={roundWind === 'east'} onChange={(e) => setRoundWind(e.target.value)} />
                                <CustomRadio label="南" name="roundWind" value="south" checked={roundWind === 'south'} onChange={(e) => setRoundWind(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-semibold text-gray-700 w-20">自風</span>
                            <div className="flex gap-2">
                                <CustomRadio label="東（親）" name="playerWind" value="east" checked={playerWind === 'east'} onChange={(e) => setPlayerWind(e.target.value)} />
                                <CustomRadio label="南" name="playerWind" value="south" checked={playerWind === 'south'} onChange={(e) => setPlayerWind(e.target.value)} />
                                <CustomRadio label="西" name="playerWind" value="west" checked={playerWind === 'west'} onChange={(e) => setPlayerWind(e.target.value)} />
                                <CustomRadio label="北" name="playerWind" value="north" checked={playerWind === 'north'} onChange={(e) => setPlayerWind(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Calculation Button and Result Display Area --- */}
                <div className="p-4 md:p-6 border-t mt-auto">
                    <button onClick={handleCalculate} disabled={isLoading || totalTiles !== 14 || !winTile} className="w-full bg-indigo-600 text-white font-bold text-xl py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                        {isLoading ? '計算中...' : '計算を実行する'}
                    </button>
                    {result && ( 
                        <div className="mt-4 p-4 bg-gray-100 rounded-lg"> {
                            result.error ? ( 
                                <p className="text-red-600 font-bold">{result.error}</p> 
                                ) : ( 
                                    <div> 
                                        <h3 className="text-lg font-bold text-gray-800">計算結果</h3> 
                                        <p className="text-2xl font-bold text-indigo-700">{result.score}</p> 
                                        <div className="mt-2"> 
                                            <span className="text-gray-600 font-bold">{result.han}翻 {result.fu}符</span> 
                                            <p className="text-gray-600">{result.yaku_list.join(' / ')}</p> 
                                        </div> 
                                    </div> 
                                )} 
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}
