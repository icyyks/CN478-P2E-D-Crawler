import { POTION_CATALOG } from '../utils/potions';

export default function PotionShopModal({ scrap, potions = {}, onBuyPotion, onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="run-loot-modal">
        <h3 style={{ marginTop: 0 }}>🛒 Potion Shop — เตรียมเสบียงก่อนลงดัน</h3>
        <p style={{ color: '#aaa', fontSize: '13px', marginTop: '-4px' }}>
          ซื้อยาฮีลพกติดตัวก่อนเข้า Battle (ระหว่างลงดันซื้อเพิ่มไม่ได้)
        </p>

        <div className="run-loot-summary-bar">
          <span>🔩 Scrap คงเหลือ: <strong>{scrap}</strong></span>
        </div>

        <div className="run-loot-grid">
          {POTION_CATALOG.map((pot) => {
            const ownedCount = Number(potions?.[pot.id] || 0);
            const canAfford = scrap >= pot.cost;

            return (
              <div key={pot.id} className={`run-loot-card ${pot.rarity}`}>
                <div style={{ fontSize: '34px', margin: '6px 0' }}>{pot.icon}</div>
                <div className="run-loot-name">{pot.name}</div>
                <div className="run-loot-meta">
                  <span style={{ color: '#81c784', fontWeight: 'bold' }}>+{pot.healAmount} HP</span>
                  <span style={{ color: '#ffd54f' }}>ราคา: {pot.cost} 🔩</span>
                  <span style={{ color: '#b0bec5' }}>พกอยู่: {ownedCount} ขวด</span>
                </div>
                <button
                  type="button"
                  className="action-btn"
                  style={{ marginTop: '10px', padding: '6px 10px', fontSize: '12px', width: '100%' }}
                  disabled={!canAfford}
                  onClick={() => onBuyPotion(pot)}
                >
                  ซื้อ ({pot.cost} 🔩)
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
          <button className="action-btn" onClick={onClose}>
            ปิดร้านค้า
          </button>
        </div>
      </div>
    </div>
  );
}