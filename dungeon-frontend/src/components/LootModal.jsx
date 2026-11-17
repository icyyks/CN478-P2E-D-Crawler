export default function LootModal({ loot, onContinue, onBackToLobby }) {
  return (
    <div className="loot-modal">
      <h2>🏆 Dungeon Cleared! 🏆</h2>
      <p>ไอเทมถูกส่งเข้า MetaMask และกระเป๋าของคุณแล้ว</p>
      
      <div className={`loot-card ${loot.rarity}`}>
        <img src={loot.image} alt={loot.itemName} />
        <h3 style={{ margin: '10px 0 5px' }}>{loot.itemName}</h3>
        <p style={{ color: '#aaa', margin: '5px 0' }}>Power: {loot.power}</p>
        <p style={{ fontSize: '12px', color: '#666' }}>Rarity: {loot.rarity}</p>
      </div>

      <div style={{ marginTop: '20px', gap: '10px', display: 'flex', justifyContent: 'center' }}>
        <button className="action-btn" onClick={onContinue}>ลงดันเจี้ยนต่อ</button>
        <button className="action-btn" style={{ backgroundColor: '#555' }} onClick={onBackToLobby}>กลับ Lobby</button>
      </div>
    </div>
  );
}