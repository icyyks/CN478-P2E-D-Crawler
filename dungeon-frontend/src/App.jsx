import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import './App.css';
import * as config from './config';
import { LOOT_CONTRACT_ADDRESS, LOOT_CONTRACT_ABI } from './contractConfig';
import { formatItemDisplayName } from './utils/enhancement';
import { DEFAULT_POTIONS } from './utils/potions';

import Header from './components/Header';
import GameOverModal from './components/GameOverModal';
import RunLootModal from './components/RunLootModal';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import Battle from './pages/Battle';
import Inventory from './pages/Inventory';

const GATEWAY = config.GATEWAY || "https://gateway.pinata.cloud/ipfs";
const cleanCore = (config.CORE_CID || "").replace(/\/$/, "");

// ของเริ่มต้น (+0) — ล็อกห้ามตีบวกและห้ามย่อย
const starterSword = {
  itemName: "Starter Sword",
  rarity: "Common",
  basePower: 5,
  power: 5,
  enhanceLevel: 0,
  image: cleanCore ? `${GATEWAY}/${cleanCore}/Sword.png` : "",
  isStarter: true
};

const starterShield = {
  itemName: "Starter Shield",
  rarity: "Common",
  basePower: 5,
  power: 5,
  enhanceLevel: 0,
  image: cleanCore ? `${GATEWAY}/${cleanCore}/Shield.png` : "",
  isStarter: true
};

const decodeBase64Json = (tokenUri) => {
  if (!tokenUri) return null;
  const prefix = "data:application/json;base64,";
  if (tokenUri.startsWith(prefix)) {
    const base64 = tokenUri.slice(prefix.length);
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const jsonText = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(jsonText);
  }
  return null;
};

function getHiddenIdsKey(walletAddr) {
  return walletAddr ? `hidden_loot_ids_${walletAddr.toLowerCase()}` : null;
}

function readHiddenIds(walletAddr) {
  const key = getHiddenIdsKey(walletAddr);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeHiddenIds(walletAddr, ids) {
  const key = getHiddenIdsKey(walletAddr);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify([...new Set(ids.map(String))]));
}

function getScrapKey(walletAddr) {
  return walletAddr ? `player_scrap_${walletAddr.toLowerCase()}` : null;
}

function readScrap(walletAddr) {
  const key = getScrapKey(walletAddr);
  if (!key) return 30;
  const raw = localStorage.getItem(key);
  return raw !== null ? Number(raw) : 30;
}

function writeScrap(walletAddr, amount) {
  const key = getScrapKey(walletAddr);
  if (!key) return;
  localStorage.setItem(key, String(Math.max(0, Number(amount) || 0)));
}

function getPotionsKey(walletAddr) {
  return walletAddr ? `player_potions_${walletAddr.toLowerCase()}` : null;
}

function readPotions(walletAddr) {
  const key = getPotionsKey(walletAddr);
  if (!key) return { ...DEFAULT_POTIONS };
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...DEFAULT_POTIONS, ...JSON.parse(raw) } : { ...DEFAULT_POTIONS };
  } catch {
    return { ...DEFAULT_POTIONS };
  }
}

function writePotions(walletAddr, nextPotions) {
  const key = getPotionsKey(walletAddr);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(nextPotions));
}

function App() {
  const [wallet, setWallet] = useState(null);
  const [screen, setScreen] = useState('login');
  const [inventory, setInventory] = useState([starterSword, starterShield]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [scrap, setScrap] = useState(30);
  const [potions, setPotions] = useState({ ...DEFAULT_POTIONS });

  const [equipped, setEquipped] = useState({
    Sword: starterSword,
    Shield: starterShield,
    Armor: null,
    Boots: null,
    Amulet: null
  });

  const [selectedDungeon, setSelectedDungeon] = useState(null);
  const [floor, setFloor] = useState(1);
  const [runLoot, setRunLoot] = useState([]);
  const [extractedSummaryItems, setExtractedSummaryItems] = useState([]);
  const [startingHP, setStartingHP] = useState(100);
  const [isExtracting, setIsExtracting] = useState(false);

  const updateScrap = (nextAmount) => {
    const safe = Math.max(0, Number(nextAmount) || 0);
    setScrap(safe);
    writeScrap(wallet, safe);
  };

  const updatePotions = (updater) => {
    setPotions(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writePotions(wallet, next);
      return next;
    });
  };

  const handleBuyPotion = (pot) => {
    if (scrap < pot.cost) return;
    updateScrap(scrap - pot.cost);
    updatePotions(prev => ({
      ...prev,
      [pot.id]: Number(prev?.[pot.id] || 0) + 1
    }));
  };

  const handleConsumePotion = (potionId) => {
    updatePotions(prev => {
      const current = Number(prev?.[potionId] || 0);
      if (current <= 0) return prev;
      return {
        ...prev,
        [potionId]: current - 1
      };
    });
  };

  const loadPlayerNFTs = async (playerAddress, provider) => {
    if (!LOOT_CONTRACT_ADDRESS || !Array.isArray(LOOT_CONTRACT_ABI) || LOOT_CONTRACT_ABI.length === 0) {
      return;
    }

    setIsLoadingItems(true);
    try {
      const hiddenSet = new Set(readHiddenIds(playerAddress).map(String));
      const contract = new ethers.Contract(LOOT_CONTRACT_ADDRESS, LOOT_CONTRACT_ABI, provider);
      const balance = Number(await contract.balanceOf(playerAddress));

      if (balance === 0) {
        setInventory([starterSword, starterShield]);
        setIsLoadingItems(false);
        return;
      }

      const fetchedItems = [];
      const batchSize = 10;
      for (let startId = 0; startId < 100 && fetchedItems.length < balance; startId += batchSize) {
        const ids = Array.from({ length: batchSize }, (_, idx) => startId + idx);
        const results = await Promise.all(
          ids.map(async (id) => {
            const idStr = id.toString();
            if (hiddenSet.has(idStr)) return null;

            try {
              const owner = await contract.ownerOf(id);
              if (owner.toLowerCase() !== playerAddress.toLowerCase()) return null;
              const uri = await contract.tokenURI(id);
              const metadata = decodeBase64Json(uri);
              if (!metadata) return null;

              const rarityAttr = metadata.attributes?.find(a => a.trait_type === "Rarity")?.value || "Common";
              const powerAttr = Number(metadata.attributes?.find(a => a.trait_type === "Power")?.value || 10);
              const enhanceAttr = Number(metadata.attributes?.find(a => a.trait_type === "Enhance")?.value || 0);
              const basePower = Math.max(1, powerAttr - enhanceAttr * 12);
              const rawImg = metadata.image || "";
              const cleanImg = rawImg.startsWith("ipfs://")
                ? `${GATEWAY}/${rawImg.replace("ipfs://", "")}`
                : rawImg;

              const itemObj = {
                tokenId: idStr,
                itemName: metadata.name,
                rarity: rarityAttr,
                basePower,
                power: powerAttr,
                enhanceLevel: enhanceAttr,
                image: cleanImg,
                isStarter: false
              };

              return {
                ...itemObj,
                itemName: formatItemDisplayName(itemObj, enhanceAttr)
              };
            } catch {
              return null;
            }
          })
        );

        for (const item of results) {
          if (item) fetchedItems.push(item);
        }
      }

      setInventory([starterSword, starterShield, ...fetchedItems]);
    } catch (err) {
      console.error("Failed to load NFTs:", err);
    }
    setIsLoadingItems(false);
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("กรุณาติดตั้ง MetaMask ก่อนครับ!");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const playerAddr = accounts[0];
      setWallet(playerAddr);
      setScrap(readScrap(playerAddr));
      setPotions(readPotions(playerAddr));
      setScreen('lobby');
      await loadPlayerNFTs(playerAddr, provider);
    } catch (error) {
      console.error("Connection failed", error);
    }
  };

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = async (accounts) => {
      if (!accounts || accounts.length === 0) {
        setWallet(null);
        setInventory([starterSword, starterShield]);
        setPotions({ ...DEFAULT_POTIONS });
        setScreen('login');
        return;
      }
      const nextAddr = accounts[0];
      setWallet(nextAddr);
      setScrap(readScrap(nextAddr));
      setPotions(readPotions(nextAddr));
      const provider = new ethers.BrowserProvider(window.ethereum);
      await loadPlayerNFTs(nextAddr, provider);
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const handleEnterDungeon = (id) => {
    setSelectedDungeon(id);
    setFloor(1);
    setRunLoot([]);
    setScreen('battle');
  };

  const handleFloorLootRolled = (rolledItem) => {
    const normalized = {
      ...rolledItem,
      enhanceLevel: 0,
      basePower: rolledItem.basePower ?? rolledItem.power,
      isStarter: false
    };
    setRunLoot(prev => [...prev, normalized]);
  };

  const handleContinueNextFloor = () => {
    setFloor(prev => prev + 1);
  };

  const handleExtractAndLeave = async () => {
    setIsExtracting(true);
    try {
      let newlyMinted = [];
      if (runLoot.length > 0) {
        const res = await axios.post('http://localhost:3000/api/extract-loot', {
          playerAddress: wallet,
          items: runLoot
        });
        newlyMinted = res.data.mintedItems && res.data.mintedItems.length > 0
          ? res.data.mintedItems
          : runLoot;

        setInventory(prev => [...prev, ...newlyMinted]);
      }
      setExtractedSummaryItems(newlyMinted);
      setRunLoot([]);
      setStartingHP(100);
      setScreen('extractSummary');
    } catch (error) {
      alert("Extract ไม่สำเร็จ: " + (error.response?.data?.error || error.message));
    }
    setIsExtracting(false);
  };

  const handleConfirmExtractSummary = () => {
    setExtractedSummaryItems([]);
    setScreen('lobby');
  };

  const handlePlayerDied = () => {
    setRunLoot([]);
    setStartingHP(70);
    setScreen('gameover');
  };

  const handleUpdateEnhancedItem = async (targetItem, result) => {
    if (targetItem.isStarter) return;

    const isSameItem = (a, b) => {
      if (!a || !b) return false;
      if (a.tokenId && b.tokenId) return String(a.tokenId) === String(b.tokenId);
      return a === b;
    };

    if (targetItem.tokenId) {
      const rawImagePath = targetItem.imagePath
        ? targetItem.imagePath
        : (targetItem.image || '').replace(`${GATEWAY}/`, '');

      await axios.post('http://localhost:3000/api/upgrade-item', {
        tokenId: targetItem.tokenId,
        itemName: result.newName,
        rarity: targetItem.rarity || 'Common',
        power: result.newPower,
        floor: targetItem.floor || 1,
        enhanceLevel: result.newLevel,
        imagePath: rawImagePath
      });
    }

    const patchItem = (item) => {
      if (!isSameItem(item, targetItem)) return item;
      return {
        ...item,
        itemName: result.newName,
        enhanceLevel: result.newLevel,
        power: result.newPower
      };
    };

    setInventory(prev => prev.map(patchItem));
    setEquipped(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(slot => {
        if (next[slot]) {
          next[slot] = patchItem(next[slot]);
        }
      });
      return next;
    });

    updateScrap(scrap - result.spentScrap);
  };

  const handleSalvageItem = async (targetItem, scrapGain) => {
    if (targetItem.isStarter) return;

    if (targetItem.tokenId) {
      await axios.post('http://localhost:3000/api/burn-item', {
        tokenId: targetItem.tokenId
      });
    }

    const isSameItem = (a, b) => {
      if (!a || !b) return false;
      if (a.tokenId && b.tokenId) return String(a.tokenId) === String(b.tokenId);
      return a === b;
    };

    setEquipped(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(slot => {
        if (isSameItem(next[slot], targetItem)) {
          next[slot] = null;
        }
      });
      return next;
    });

    setInventory(prev => prev.filter(item => !isSameItem(item, targetItem)));

    if (targetItem.tokenId && wallet) {
      const currentHidden = readHiddenIds(wallet);
      writeHiddenIds(wallet, [...currentHidden, targetItem.tokenId]);
    }

    updateScrap(scrap + scrapGain);
  };

  return (
    <div className="container">
      {screen === 'login' && <Login onConnect={connectWallet} />}

      {screen !== 'login' && (
        <>
          <Header wallet={wallet} />
          {isLoadingItems && <p style={{ color: '#aaa', fontSize: '12px' }}>⏳ กำลังดึง NFT จากกระเป๋า...</p>}

          {screen === 'lobby' && (
            <Lobby
              equipped={equipped}
              scrap={scrap}
              potions={potions}
              onBuyPotion={handleBuyPotion}
              startingHP={startingHP}
              onOpenInventory={() => setScreen('inventory')}
              onEnterDungeon={handleEnterDungeon}
            />
          )}

          {screen === 'inventory' && (
            <Inventory
              inventory={inventory}
              equipped={equipped}
              setEquipped={setEquipped}
              scrap={scrap}
              potions={potions}
              onSalvageItem={handleSalvageItem}
              onEnhanceItem={handleUpdateEnhancedItem}
              onBack={() => setScreen('lobby')}
            />
          )}

          {screen === 'battle' && (
            <Battle
              dungeonId={selectedDungeon}
              floor={floor}
              startingHP={startingHP}
              runLoot={runLoot}
              equipped={equipped}
              potions={potions}
              isExtracting={isExtracting}
              onConsumePotion={handleConsumePotion}
              onFloorLootRolled={handleFloorLootRolled}
              onNextFloor={handleContinueNextFloor}
              onExtractAndLeave={handleExtractAndLeave}
              onPlayerDied={handlePlayerDied}
            />
          )}

          {screen === 'extractSummary' && (
            <RunLootModal
              title="✅ Extract สำเร็จ — สรุปไอเทมสุทธิที่ได้รับ"
              subtitle="ไอเทมทั้งหมดเริ่มต้นที่ +0 และถูก Mint เข้ากระเป๋า MetaMask แล้ว"
              items={extractedSummaryItems}
              confirmLabel="ยืนยันกลับ Lobby"
              onConfirm={handleConfirmExtractSummary}
            />
          )}

          {screen === 'gameover' && (
            <GameOverModal
              lostCount={runLoot.length}
              floorReached={floor}
              penaltyHP={startingHP}
              onReturnLobby={() => setScreen('lobby')}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;