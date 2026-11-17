import { useState } from 'react';
import { GATEWAY, CORE_CID } from '../config';
import { POTION_CATALOG } from '../utils/potions';
import PotionShopModal from '../components/PotionShopModal';

const LOBBY_SLOTS = ['Sword', 'Armor', 'Shield', 'Boots', 'Amulet'];

function getTotalPower(equipped) {
  return Object.values(equipped || {}).reduce((sum, item) => {
    return sum + (item ? Number(item.power) || 0 : 0);
  }, 0);
}

export default function Lobby({
  equipped,
  scrap = 0,
  potions = {},
  onBuyPotion,
  startingHP = 100,
  onOpenInventory,
  onEnterDungeon
}) {
  const [showShop, setShowShop] = useState(false);
  const cleanCore = (CORE_CID || '').replace(/\/$/, '');
  const totalPower = getTotalPower(equipped);

  return (
    <div className="lobby-layout">
      <div className="profile-section">
        <h3>📝 Profile</h3>
        <img src={`${GATEWAY}/${cleanCore}/Player.png`} alt="Player" className="avatar-large" />

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '12px' }}>
          <div className="total-power-badge">
            ⚡ Total Power: <strong>{totalPower}</strong> Pwr
          </div>
          <div className="scrap-badge">
            🔩 Scrap: <strong>{scrap}</strong>
          </div>
        </div>

        {startingHP < 100 && (
          <p style={{ color: '#ffd54f', fontSize: '12px', margin: '8px 0 0' }}>
            ⚠️ Penalty: เริ่มต้น {startingHP} HP
          </p>
        )}

        <div className="mini-equip-preview">
          {LOBBY_SLOTS.map(slot => {
            const item = equipped?.[slot];
            const rarityClass = item ? `rarity-bg-${item.rarity || 'Common'}` : '';

            return (
              <div
                key={slot}
                className={`mini-slot ${rarityClass}`}
                title={item ? `${item.itemName} (${item.power} Pwr)` : slot}
              >
                {item ? (
                  <>
                    <img src={item.image} alt={item.itemName} />
                    <span className="mini-pwr-text">{item.power}</span>
                  </>
                ) : (
                  slot.slice(0, 3)
                )}
              </div>
            );
          })}
        </div>

        <div className="potion-pouch-bar" style={{ marginBottom: '12px' }}>
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

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button className="action-btn" style={{ flex: 1 }} onClick={onOpenInventory}>
            🎒 เปิดกระเป๋า
          </button>
          <button
            className="action-btn"
            style={{ flex: 1, backgroundColor: '#1565c0' }}
            onClick={() => setShowShop(true)}
          >
            🛒 Shop
          </button>
        </div>
      </div>

      <div className="dungeon-section">
        <h3>🗺️ World Map</h3>

        <div className="dungeon-card">
          <div>
            <h4 style={{ margin: '0 0 5px 0' }}>🍺 ดันเจี้ยนรังสิต (Rangsit)</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#aaa' }}>สู้กับขวดเหล้า เพื่อฟาร์มชุดนักศึกษาและพระสมเด็จ</p>
          </div>
          <button className="enter-btn" onClick={() => onEnterDungeon('rangsit')}>Enter</button>
        </div>
      </div>

      {showShop && (
        <PotionShopModal
          scrap={scrap}
          potions={potions}
          onBuyPotion={onBuyPotion}
          onClose={() => setShowShop(false)}
        />
      )}
    </div>
  );
}