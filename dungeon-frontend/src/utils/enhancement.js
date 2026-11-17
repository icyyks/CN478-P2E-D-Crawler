export const MAX_ENHANCE_LEVEL = 8;

export const ENHANCE_TABLE = {
  0: { cost: 15,  chance: 100, minDrop: 0, maxDrop: 0 },
  1: { cost: 25,  chance: 85,  minDrop: 0, maxDrop: 0 },
  2: { cost: 40,  chance: 70,  minDrop: 0, maxDrop: 0 },
  3: { cost: 65,  chance: 55,  minDrop: 1, maxDrop: 1 },
  4: { cost: 100, chance: 40,  minDrop: 1, maxDrop: 2 },
  5: { cost: 150, chance: 28,  minDrop: 1, maxDrop: 3 },
  6: { cost: 220, chance: 18,  minDrop: 1, maxDrop: 5 },
  7: { cost: 320, chance: 10,  minDrop: 1, maxDrop: 6 }
};

export function getBasePower(item) {
  if (!item) return 0;
  if (typeof item.basePower === 'number') return item.basePower;
  const currentLevel = Number(item.enhanceLevel || 0);
  const currentPower = Number(item.power || 0);
  return Math.max(1, currentPower - currentLevel * 12);
}

export function calculatePowerForLevel(basePower, enhanceLevel) {
  const lvl = Number(enhanceLevel || 0);
  return Number(basePower || 0) + lvl * 12;
}

export function formatItemDisplayName(item, enhanceLevel = item?.enhanceLevel ?? 0) {
  const rawName = (item?.itemName || '').replace(/\s*\(\+\d+\)\s*$/, '').trim();
  const lvl = Number(enhanceLevel || 0);
  return lvl > 0 ? `${rawName} (+${lvl})` : rawName;
}

export function getSalvageScrapAmount(item) {
  if (!item || item.isStarter) return 0;
  const rarity = item.rarity || 'Common';
  const lvl = Number(item.enhanceLevel || 0);
  const baseScrap = rarity === 'Legendary' ? 60 : rarity === 'Rare' ? 25 : 10;
  return baseScrap + lvl * 8;
}

export function rollEnhanceAttempt(item, currentScrap) {
  const currentLevel = Number(item.enhanceLevel || 0);
  if (item.isStarter) {
    return { ok: false, reason: "ของเริ่มต้นไม่สามารถตีบวกได้" };
  }
  if (currentLevel >= MAX_ENHANCE_LEVEL) {
    return { ok: false, reason: "ตีบวกถึงขั้นสูงสุด (+8) แล้ว" };
  }

  const rule = ENHANCE_TABLE[currentLevel];
  if (currentScrap < rule.cost) {
    return { ok: false, reason: `เศษเหล็กไม่พอ (ต้องการ ${rule.cost} 🔩)` };
  }

  const roll = Math.floor(Math.random() * 100) + 1;
  const basePower = getBasePower(item);

  if (roll <= rule.chance) {
    const nextLevel = currentLevel + 1;
    const nextPower = calculatePowerForLevel(basePower, nextLevel);
    return {
      ok: true,
      success: true,
      spentScrap: rule.cost,
      oldLevel: currentLevel,
      newLevel: nextLevel,
      newPower: nextPower,
      newName: formatItemDisplayName(item, nextLevel),
      message: `✨ ตีบวกสำเร็จ! ${formatItemDisplayName(item, nextLevel)} (${nextPower} Pwr)`
    };
  }

  const dropRange = rule.maxDrop - rule.minDrop + 1;
  const dropSteps = rule.maxDrop > 0
    ? Math.floor(Math.random() * dropRange) + rule.minDrop
    : 0;
  const minFloorLevel = currentLevel >= 4 ? 1 : 0;
  const newLevel = Math.max(minFloorLevel, currentLevel - dropSteps);
  const newPower = calculatePowerForLevel(basePower, newLevel);

  return {
    ok: true,
    success: false,
    spentScrap: rule.cost,
    oldLevel: currentLevel,
    newLevel,
    newPower,
    newName: formatItemDisplayName(item, newLevel),
    message: newLevel < currentLevel
      ? `💥 ตีแตก! ระดับร่วงจาก +${currentLevel} เหลือ +${newLevel} (${newPower} Pwr)`
      : `💨 ตีบวกไม่ติด! คงอยู่ที่ +${newLevel}`
  };
}

