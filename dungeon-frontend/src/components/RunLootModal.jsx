export default function RunLootModal({
  title,
  subtitle,
  items = [],
  confirmLabel = "ปิดหน้าต่าง",
  onConfirm
}) {
  const totalPower = items.reduce((sum, item) => sum + (Number(item.power) || 0), 0);

  return (
    <div className="modal-backdrop">
      <div className="run-loot-modal">
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        {subtitle && <p style={{ color: '#aaa', fontSize: '13px', marginTop: '-4px' }}>{subtitle}</p>}

        <div className="run-loot-summary-bar">
          <span>📦 จำนวนไอเทม: <strong>{items.length}</strong> ชิ้น</span>
          <span>⚡ รวม Power: <strong>{totalPower}</strong> Pwr</span>
        </div>

        {items.length === 0 ? (
          <p style={{ color: '#888', padding: '24px 0' }}>ยังไม่มีไอเทมดรอปในรอบนี้...</p>
        ) : (
          <div className="run-loot-grid">
            {items.map((item, index) => (
              <div key={index} className={`run-loot-card ${item.rarity || 'Common'}`}>
                <img src={item.image} alt={item.itemName} />
                <div className="run-loot-name">{item.itemName}</div>
                <div className="run-loot-meta">
                  <span className={`rarity-tag ${item.rarity || 'Common'}`}>
                    {item.rarity || 'Common'}
                  </span>
                  <span className="power-tag">⚡ {item.power} Pwr</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
          <button className="action-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}