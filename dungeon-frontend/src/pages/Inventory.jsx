import { useState } from 'react';
import { GATEWAY, CORE_CID } from '../config';
import { POTION_CATALOG } from '../utils/potions';
import {
  MAX_ENHANCE_LEVEL,
  ENHANCE_TABLE,
  getBasePower,
  calculatePowerForLevel,
  getSalvageScrapAmount,
  rollEnhanceAttempt
} from '../utils/enhancement';

const CATEGORIES = ['All', 'Sword', 'Shield', 'Armor', 'Boots', 'Amulet'];
const EQUIP_SLOTS = ['Amulet', 'Sword', 'Armor', 'Shield', 'Boots'];

function getItemCategory(item) {
  const name = item?.itemName || '';
  if (name.includes('Sword')) return 'Sword';
  if (name.includes('Shield')) return 'Shield';
  if (name.includes('Armor')) return 'Armor';
  if (name.includes('Boots')) return 'Boots';
  if (name.includes('Amulet')) return 'Amulet';
  return 'Other';
}

function getTotalPower(equipped) {
  return Object.values(equipped).reduce((sum, item) => {
    return sum + (item ? Number(item.power) || 0 : 0);
  }, 0);
}

export default function Inventory({
  inventory,
  equipped,
  setEquipped,
  scrap = 0,
  potions = {},
  onSalvageItem,
  onEnhanceItem,
  onBack
}) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [craftLog, setCraftLog] = useState('');
  const [isBusyCraft, setIsBusyCraft] = useState(false);

  const cleanCore = (CORE_CID || '').replace(/\/$/, '');
  const totalPower = getTotalPower(equipped);

  const filteredInventory = selectedCategory === 'All'
    ? inventory
    : inventory.filter(item => getItemCategory(item) === selectedCategory);

  const selectedItem = filteredInventory[selectedIndex] || filteredInventory[0] || null;

  const equipItem = (item) => {
    const category = getItemCategory(item);
    if (category !== 'Other') {
      setEquipped(prev => ({ ...prev, [category]: item }));
    }
  };

  const isItemEquipped = (item) => {
    const category = getItemCategory(item);
    const activeSlotItem = equipped[category];
    if (!activeSlotItem) return false;

    if (item.tokenId && activeSlotItem.tokenId) {
      return String(item.tokenId) === String(activeSlotItem.tokenId);
    }
    return item.isStarter && activeSlotItem.isStarter && item.itemName === activeSlotItem.itemName;
  };

  const handleUpgradeClick = async () => {
    if (!selectedItem || isBusyCraft) return;
    const result = rollEnhanceAttempt(selectedItem, scrap);
    if (!result.ok) {
      setCraftLog(`⚠️ ${result.reason}`);
      return;
    }

    setIsBusyCraft(true);
    setCraftLog(`⏳ กำลังอัปเดตระดับ +${result.newLevel} ลง Blockchain...`);
    try {
      await onEnhanceItem(selectedItem, result);
      setCraftLog(result.message);
    } catch (err) {
      setCraftLog(`❌ ตีบวกไม่สำเร็จ: ${err.response?.data?.error || err.message}`);
    }
    setIsBusyCraft(false);
  };

  const handleSalvageClick = async () => {
    if (!selectedItem || selectedItem.isStarter || isBusyCraft) return;
    const gain = getSalvageScrapAmount(selectedItem);

    setIsBusyCraft(true);
    setCraftLog(`🔥 กำลังเผา NFT ทิ้งบน Blockchain...`);
    try {
      await onSalvageItem(selectedItem, gain);
      setCraftLog(`♻️ ย่อยและเผา ${selectedItem.itemName} สำเร็จ ได้รับ ${gain} 🔩 Scrap`);
      setSelectedIndex(0);
    } catch (err) {
      setCraftLog(`❌ ย่อยไม่สำเร็จ: ${err.response?.data?.error || err.message}`);
    }
    setIsBusyCraft(false);
  };

  const currentEnhance = Number(selectedItem?.enhanceLevel || 0);
  const nextRule = currentEnhance < MAX_ENHANCE_LEVEL ? ENHANCE_TABLE[currentEnhance] : null;
  const basePower = getBasePower(selectedItem);
  const nextPower = nextRule ? calculatePowerForLevel(basePower, currentEnhance + 1) : selectedItem?.power;
  const salvageGain = getSalvageScrapAmount(selectedItem);

  return (
    <div className="inventory-screen">
      <div className="inv-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>🎒 คลังสมบัติ & สวมใส่</h2>
          <div className="scrap-badge">
            🔩 Scrap: <strong>{scrap}</strong>
          </div>
        </div>
        <button className="action-btn" onClick={onBack} disabled={isBusyCraft}>กลับ Lobby</button>
      </div>

      <div className="inventory-layout">
        {/* แผงด้านซ้าย: โชว์ตัวละคร พลังรวม ช่องสวมใส่ และช่องยาฮีล */}
        <div className="equip-panel">
          <img src={`${GATEWAY}/${cleanCore}/Player.png`} alt="Player" className="avatar-large" />

          <div className="total-power-badge" style={{ marginTop: '12px' }}>
            ⚡ Total Power: <strong>{totalPower}</strong> Pwr
          </div>

          <div className="equip-grid">
            {EQUIP_SLOTS.map(slotName => {
              const slotItem = equipped[slotName];
              const rarityClass = slotItem ? `rarity-bg-${slotItem.rarity || 'Common'}` : '';

              return (
                <div
                  key={slotName}
                  className={`equip-slot slot-${slotName.toLowerCase()} ${rarityClass}`}
                  title={slotItem ? `${slotItem.itemName} (${slotItem.power} Pwr)` : slotName}
                >
                  {slotItem ? (
                    <div className="equipped-slot-content">
                      <img src={slotItem.image} alt={slotItem.itemName} />
                      <span className="slot-pwr-label">{slotItem.power} Pwr</span>
                    </div>
                  ) : (
                    slotName
                  )}
                </div>
              );
            })}
          </div>

          <div className="potion-pouch-bar" style={{ marginTop: '14px' }}>
            {POTION_CATALOG.map(pot => (
              <div
                key={pot.id}
                className={`potion-slot-pill rarity-bg-${pot.rarity}`}
                title={`${pot.name} (+${pot.healAmount} HP)`}
              >
                <span>{pot.icon}</span>
                <strong>x{potions?.[pot.id] || 0}</strong>
              </div>
            ))}
          </div>

          <p style={{ marginTop: '16px', color: '#aaa', fontSize: '13px' }}>
            คลิกที่ไอเทมฝั่งขวาเพื่อเลือก / สวมใส่
          </p>
        </div>

        {/* แผงด้านขวา: Filter หมวดหมู่ + กระเป๋า + แผงตีบวก/ย่อยของ */}
        <div className="items-panel">
          <div className="filter-bar">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                disabled={isBusyCraft}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSelectedIndex(0);
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="inventory-grid-large">
            {filteredInventory.map((item, index) => {
              const rarity = item.rarity || 'Common';
              const isEquipped = isItemEquipped(item);
              const isSelected = selectedItem && (
                (item.tokenId && selectedItem.tokenId && String(item.tokenId) === String(selectedItem.tokenId)) ||
                (item === selectedItem)
              );

              return (
                <div
                  key={item.tokenId ? `nft-${item.tokenId}` : `temp-${item.itemName}-${index}`}
                  className={`inv-item rarity-bg-${rarity} ${isEquipped ? 'equipped-item' : ''} ${isSelected ? 'selected-item' : ''}`}
                  onClick={() => {
                    if (isBusyCraft) return;
                    setSelectedIndex(index);
                    equipItem(item);
                  }}
                  title={`${item.itemName} (${rarity} • ${item.power} Pwr)`}
                >
                  {isEquipped && <span className="equipped-badge">EQUIPPED</span>}
                  {Number(item.enhanceLevel || 0) > 0 && (
                    <span className="enhance-pill">+{item.enhanceLevel}</span>
                  )}
                  <img src={item.image} alt={item.itemName} />
                  <div className="inv-item-footer">
                    <span className={`rarity-label ${rarity}`}>{rarity}</span>
                    <span>{item.power} Pwr</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* แผงตีบวก (+0..+8) และย่อยของ */}
          {selectedItem && (
            <div className="craft-panel">
              <div className="craft-header">
                <div>
                  <strong>{selectedItem.itemName}</strong>{' '}
                  <span className="enhance-tag">+{currentEnhance} / +{MAX_ENHANCE_LEVEL}</span>
                </div>
                <span style={{ color: '#81c784', fontWeight: 'bold' }}>
                  Power: {selectedItem.power} Pwr
                  {nextRule ? ` → ${nextPower} Pwr` : ' (MAX)'}
                </span>
              </div>

              {selectedItem.isStarter ? (
                <p className="starter-lock-note">
                  🔒 ของเริ่มต้น (Starter) ไม่สามารถตีบวกหรือย่อยเป็นเศษเหล็กได้
                </p>
              ) : (
                <>
                  <div className="craft-meta">
                    {nextRule ? (
                      <>
                        <span>🔨 ตีบวก +{currentEnhance} → +{currentEnhance + 1}</span>
                        <span>ใช้: <strong>{nextRule.cost} 🔩</strong></span>
                        <span>โอกาสติด: <strong>{nextRule.chance}%</strong></span>
                        {nextRule.maxDrop > 0 && (
                          <span style={{ color: '#ff8a80' }}>
                            แตก: ลด {nextRule.minDrop}–{nextRule.maxDrop} ขั้น
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: '#ffd54f' }}>⭐ ถึงระดับสูงสุด (+8) แล้ว</span>
                    )}
                  </div>

                  <div className="craft-actions">
                    <button
                      type="button"
                      className="action-btn"
                      disabled={isBusyCraft || !nextRule || scrap < nextRule.cost}
                      onClick={handleUpgradeClick}
                    >
                      {isBusyCraft
                        ? '⏳ กำลังทำงาน...'
                        : `🔨 ตีบวก (+${Math.min(MAX_ENHANCE_LEVEL, currentEnhance + 1)})`}
                    </button>

                    <button
                      type="button"
                      className="action-btn"
                      style={{ backgroundColor: '#6d4c41' }}
                      disabled={isBusyCraft}
                      onClick={handleSalvageClick}
                    >
                      {isBusyCraft ? '⏳ กำลังทำงาน...' : `♻️ ย่อยรับ ${salvageGain} 🔩`}
                    </button>
                  </div>
                </>
              )}

              {craftLog && <div className="craft-log">{craftLog}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}