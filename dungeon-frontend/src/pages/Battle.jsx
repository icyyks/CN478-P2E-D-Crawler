import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { GATEWAY, CORE_CID, RANGSIT_CID } from '../config';
import { POTION_CATALOG } from '../utils/potions';
import RunLootModal from '../components/RunLootModal';

function getMonsterCountByFloor(floor) {
  if (floor >= 5) return 3;
  if (floor >= 3) return 2;
  return 1;
}

function createMonstersForFloor(floor, dungeonId) {
  const count = getMonsterCountByFloor(floor);
  const maxHP = 30 + ((floor - 1) * 20);
  const cleanCore = CORE_CID.replace(/\/$/, "");
  const cleanRangsit = RANGSIT_CID.replace(/\/$/, "");

  return Array.from({ length: count }, (_, idx) => {
    const monsterIndex = ((floor + idx - 1) % 3) + 1;
    const image = dungeonId === 'rangsit'
      ? `${GATEWAY}/${cleanRangsit}/Monster${monsterIndex}.png`
      : `${GATEWAY}/${cleanCore}/Monster${monsterIndex}.png`;

    return {
      id: idx + 1,
      name: `Monster #${idx + 1}`,
      hp: maxHP,
      maxHP,
      image
    };
  });
}

export default function Battle({
  dungeonId,
  floor,
  startingHP,
  runLoot,
  equipped,
  potions = {},
  isExtracting,
  onConsumePotion,
  onFloorLootRolled,
  onNextFloor,
  onExtractAndLeave,
  onPlayerDied
}) {
  const [playerHP, setPlayerHP] = useState(startingHP);
  const [monsters, setMonsters] = useState(() => createMonstersForFloor(floor, dungeonId));
  const [logs, setLogs] = useState([]);
  const [isBattling, setIsBattling] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [floorCleared, setFloorCleared] = useState(false);
  const [lastRolledItem, setLastRolledItem] = useState(null);
  const [showRunLootModal, setShowRunLootModal] = useState(false);

  const logEndRef = useRef(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  useEffect(() => {
    const spawnList = createMonstersForFloor(floor, dungeonId);

    // รีเซ็ตเลือดเฉพาะตอนเริ่มเข้าดันเจี้ยนชั้นที่ 1 เท่านั้น ชั้นถัดไปใช้เลือดเดิมต่อเนื่อง
    if (floor === 1) {
      setPlayerHP(startingHP);
    }

    setMonsters(spawnList);
    setIsBattling(false);
    setIsRolling(false);
    setFloorCleared(false);
    setLastRolledItem(null);
    setLogs([
      `🚪 เข้าสู่ ${dungeonId.toUpperCase()} ชั้นที่ ${floor}`,
      `👾 ชั้นนี้มีมอนสเตอร์ทั้งหมด ${spawnList.length} ตัว! (HP ตัวละ ${spawnList[0].maxHP})`,
      floor === 1 && startingHP < 100
        ? `⚠️ บทลงโทษจากรอบที่แล้ว: เริ่มต้นด้วย ${startingHP} HP!`
        : floor > 1
        ? `❤️ ลุยต่อด้วย HP คงเหลือจากชั้นก่อนหน้า!`
        : null
    ].filter(Boolean));
  }, [floor, dungeonId, startingHP]);

  const getPlayerPower = () => {
    let power = 10;
    if (equipped.Sword) power += equipped.Sword.power;
    if (equipped.Amulet) power += Math.floor(equipped.Amulet.power / 2);
    return power;
  };

  // ฟังก์ชันให้มอนสเตอร์ที่เหลือรุมโจมตีสวนกลับ (damageMultiplier = 0.7 ตอนตั้งการ์ดดื่มยา)
  const triggerMonsterCounterAttack = (aliveMonsters, currentHP, damageMultiplier = 1) => {
    setIsBattling(true);
    setTimeout(() => {
      let totalIncomingDmg = 0;
      aliveMonsters.forEach(() => {
        const rawDmg = Math.floor(Math.random() * (4 + floor * 2)) + (3 + floor * 2);
        const finalDmg = Math.max(1, Math.round(rawDmg * damageMultiplier));
        totalIncomingDmg += finalDmg;
      });

      const nextHP = Math.max(0, currentHP - totalIncomingDmg);
      setPlayerHP(nextHP);
      setLogs(prev => [
        ...prev,
        damageMultiplier < 1
          ? `🛡️ มอนสเตอร์ ${aliveMonsters.length} ตัวโจมตีใส่ขณะคุณตั้งการ์ดดื่มยา (ลดดาเมจ 30%): เสียรวม ${totalIncomingDmg} HP`
          : `💥 มอนสเตอร์ที่เหลือ ${aliveMonsters.length} ตัวสวนกลับ: คุณเสียรวม ${totalIncomingDmg} HP`
      ]);
      setIsBattling(false);

      if (nextHP <= 0) {
        setTimeout(() => {
          onPlayerDied();
        }, 600);
      }
    }, 850);
  };

  const handleDrinkPotion = (pot) => {
    const owned = Number(potions?.[pot.id] || 0);
    if (owned <= 0 || isBattling || isRolling || playerHP <= 0 || playerHP >= 100) return;

    const healedHP = Math.min(100, playerHP + pot.healAmount);
    const actualHeal = healedHP - playerHP;

    setPlayerHP(healedHP);
    onConsumePotion(pot.id);

    const aliveMonsters = monsters.filter(m => m.hp > 0);

    // ถ้าดื่มยาระหว่างต่อสู้ (มอนยังไม่ตายหมด) จะนับว่าจบเทิร์นทันที และมอนสวนกลับ
    if (!floorCleared && aliveMonsters.length > 0) {
      setLogs(prev => [
        ...prev,
        `🧪 คุณใช้เทิร์นนี้ดื่ม ${pot.name}: ฟื้นฟู +${actualHeal} HP (เหลือ ${owned - 1} ขวด) — จบเทิร์น!`
      ]);
      triggerMonsterCounterAttack(aliveMonsters, healedHP, 0.7);
    } else {
      // ถ้าเคลียร์มอนหมดชั้นแล้ว ดื่มเตรียมตัวก่อนลงชั้นต่อไปได้ฟรี
      setLogs(prev => [
        ...prev,
        `🧪 ดื่ม ${pot.name} เตรียมพร้อมก่อนไปต่อ: ฟื้นฟู +${actualHeal} HP (เหลือ ${owned - 1} ขวด)`
      ]);
    }
  };

  const attack = async () => {
    const aliveMonsters = monsters.filter(m => m.hp > 0);
    if (aliveMonsters.length === 0 || isBattling || isRolling || playerHP <= 0) return;

    const target = aliveMonsters[0];
    const totalPower = getPlayerPower();
    const playerDmg = Math.floor(Math.random() * 10) + totalPower;

    const updatedMonsters = monsters.map(m => {
      if (m.id !== target.id) return m;
      return { ...m, hp: Math.max(0, m.hp - playerDmg) };
    });

    setMonsters(updatedMonsters);
    setLogs(prev => [...prev, `⚔️ คุณโจมตี ${target.name}: ลด ${playerDmg} HP`]);

    const remaining = updatedMonsters.filter(m => m.hp > 0);
    if (remaining.length === 0) {
      setLogs(prev => [...prev, `💀 กำจัดมอนสเตอร์ครบชั้นที่ ${floor}! กำลังสุ่มของดรอป... ห้ามกดออกจนกว่าจะเสร็จ!`]);
      setIsRolling(true);
      try {
        const response = await axios.post('http://localhost:3000/api/roll-loot', {
          dungeonId,
          floor
        });
        const rolledItem = response.data.item;
        setLastRolledItem(rolledItem);
        onFloorLootRolled(rolledItem);
        setFloorCleared(true);
        setLogs(prev => [...prev, `🎁 สุ่มได้: ${rolledItem.itemName} (${rolledItem.power} Pwr) — เก็บเข้ากระเป๋ารอบนี้แล้ว!`]);
      } catch (error) {
        const errMsg = error.response?.data?.error || error.message;
        setLogs(prev => [...prev, `❌ สุ่มไอเทมไม่สำเร็จ: ${errMsg}`]);
      }
      setIsRolling(false);
      return;
    }

    triggerMonsterCounterAttack(remaining, playerHP, 1);
  };

  const cleanCore = CORE_CID.replace(/\/$/, "");
  const aliveCount = monsters.filter(m => m.hp > 0).length;

  return (
    <>
      <div className="battle-top-bar">
        <div>
          <h3 style={{ margin: '0 0 4px 0' }}>
            📍 {dungeonId.toUpperCase()} — Floor {floor}
          </h3>
          <span style={{ fontSize: '13px', color: '#ffb74d' }}>
            👾 มอนสเตอร์ในชั้นนี้: {monsters.length} ตัว (เหลือ {aliveCount} ตัว)
          </span>
        </div>

        <button
          className="run-loot-icon-btn"
          onClick={() => setShowRunLootModal(true)}
          title="ดูไอเทมที่สะสมในรอบนี้"
        >
          🎒 Run Loot ({runLoot.length})
        </button>
      </div>

      <div className="battle-arena" style={{ flexWrap: 'wrap', gap: '20px' }}>
        <div className="character">
          <img src={`${GATEWAY}/${cleanCore}/Player.png`} alt="Player" className="avatar" />
          <div className="hp-bar-container">
            <div className="hp-bar player" style={{ width: `${Math.max(0, playerHP)}%` }}></div>
            <span className="hp-text">{playerHP} / 100</span>
          </div>

          <div className="battle-potion-row">
            {POTION_CATALOG.map(pot => {
              const count = Number(potions?.[pot.id] || 0);
              return (
                <button
                  key={pot.id}
                  type="button"
                  className="battle-potion-btn"
                  disabled={count <= 0 || isBattling || isRolling || playerHP <= 0 || playerHP >= 100}
                  onClick={() => handleDrinkPotion(pot)}
                  title={
                    floorCleared
                      ? `ดื่ม ${pot.name} (+${pot.healAmount} HP) เตรียมตัวก่อนลงชั้นถัดไป`
                      : `ดื่ม ${pot.name} (+${pot.healAmount} HP) — ใช้เทิร์นนี้และตั้งรับ (ลดดาเมจมอน 30%)`
                  }
                >
                  {pot.icon} +{pot.healAmount} ({count})
                </button>
              );
            })}
          </div>

          {!floorCleared && !isRolling && (
            <button
              className="action-btn"
              style={{ marginTop: '8px' }}
              onClick={attack}
              disabled={isBattling || playerHP <= 0}
            >
              {isBattling ? "รอเทิร์น..." : "โจมตี (Attack)"}
            </button>
          )}
        </div>

        <h2>VS</h2>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {monsters.map((m) => (
            <div
              key={m.id}
              className="character"
              style={{ width: '150px', opacity: m.hp === 0 ? 0.35 : 1 }}
            >
              <img
                src={m.image}
                alt={m.name}
                className="avatar"
                style={{ width: '110px', height: '110px' }}
              />
              <div style={{ fontSize: '12px', marginBottom: '6px' }}>
                {m.name} {m.hp === 0 ? "(ตายแล้ว)" : ""}
              </div>
              <div className="hp-bar-container">
                <div className="hp-bar monster" style={{ width: `${(m.hp / m.maxHP) * 100}%` }}></div>
                <span className="hp-text">{m.hp} / {m.maxHP}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isRolling && (
        <div className="rolling-banner">
          🎲 กำลังสุ่มของดรอปชั้นที่ {floor}... กรุณารอสักครู่ (ล็อกปุ่มชั่วคราว)
        </div>
      )}

      {floorCleared && !isRolling && lastRolledItem && (
        <div className="floor-loot-banner">
          🎁 ชั้นที่ {floor} ดรอป: <strong>{lastRolledItem.itemName}</strong> ({lastRolledItem.rarity} • {lastRolledItem.power} Pwr)
        </div>
      )}

      <div className="battle-log">
        {logs.map((log, i) => <div key={i}>{log}</div>)}
        <div ref={logEndRef} />
      </div>

      {!isRolling && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {floorCleared && (
            <button
              className="action-btn"
              style={{ backgroundColor: '#d32f2f' }}
              disabled={isExtracting}
              onClick={onNextFloor}
            >
              ⏬ ลงชั้นต่อไป (Floor {floor + 1} — {getMonsterCountByFloor(floor + 1)} ตัว)
            </button>
          )}

          {floorCleared && (
            <button
              className="action-btn"
              style={{ backgroundColor: '#2e7d32' }}
              disabled={isExtracting}
              onClick={onExtractAndLeave}
            >
              {isExtracting ? "⏳ กำลัง Mint เข้ากระเป๋า..." : `💰 หนีกลับ Lobby & รับของ (${runLoot.length} ชิ้น)`}
            </button>
          )}
        </div>
      )}

      {showRunLootModal && (
        <RunLootModal
          title={`🎒 ไอเทมในรอบนี้ (${dungeonId.toUpperCase()} — Floor ${floor})`}
          subtitle="หากตายกลางทาง ของทั้งหมดในรายการนี้จะหายไป"
          items={runLoot}
          confirmLabel="ปิดหน้าต่าง"
          onConfirm={() => setShowRunLootModal(false)}
        />
      )}
    </>
  );
}