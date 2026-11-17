require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const contractABI = JSON.parse(fs.readFileSync('./abi.json', 'utf8'));
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);

const RANGSIT_CID = "bafybeialkjhn4u2ct37r3z5ryen53wa34ia22cdedpkutwpx6qpv7ekqje";

const dungeonLootPools = {
    rangsit: {
        Sword: `${RANGSIT_CID}/Sword.png`,
        Shield: `${RANGSIT_CID}/Shield.png`,
        Armor: `${RANGSIT_CID}/BodyArmour.png`,
        Boots: `${RANGSIT_CID}/Boots.png`,
        Amulet: `${RANGSIT_CID}/Amulet.png`
    }
};

function getRaritiesByFloor(floor = 1) {
    if (floor >= 5) {
        return [
            { name: "Common", chance: 20, minStat: 15, maxStat: 30 },
            { name: "Rare", chance: 45, minStat: 60, maxStat: 100 },
            { name: "Legendary", chance: 35, minStat: 220, maxStat: 350 }
        ];
    }
    if (floor >= 3) {
        return [
            { name: "Common", chance: 45, minStat: 12, maxStat: 25 },
            { name: "Rare", chance: 40, minStat: 55, maxStat: 90 },
            { name: "Legendary", chance: 15, minStat: 200, maxStat: 320 }
        ];
    }
    return [
        { name: "Common", chance: 75, minStat: 10, maxStat: 20 },
        { name: "Rare", chance: 20, minStat: 50, maxStat: 80 },
        { name: "Legendary", chance: 5, minStat: 200, maxStat: 300 }
    ];
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildTokenURI({ itemName, rarity, power, floor, enhanceLevel, imagePath }) {
    const metadataJson = {
        name: itemName,
        description: `A ${rarity} item from Floor ${floor}.`,
        image: `ipfs://${imagePath}`,
        attributes: [
            { trait_type: "Rarity", value: rarity },
            { trait_type: "Power", value: Number(power) },
            { trait_type: "Floor", value: Number(floor) },
            { trait_type: "Enhance", value: Number(enhanceLevel) }
        ]
    };
    const base64Metadata = Buffer.from(JSON.stringify(metadataJson)).toString('base64');
    return `data:application/json;base64,${base64Metadata}`;
}

function rollSingleItem(dungeonId, floor) {
    const currentPool = dungeonLootPools[dungeonId];
    const itemTypes = Object.keys(currentPool);

    const randomType = itemTypes[getRandomInt(0, itemTypes.length - 1)];
    const imagePath = currentPool[randomType];

    const rarities = getRaritiesByFloor(Number(floor));
    const roll = getRandomInt(1, 100);
    let selectedRarity = rarities[0];
    let cumulative = 0;
    for (let r of rarities) {
        cumulative += r.chance;
        if (roll <= cumulative) {
            selectedRarity = r;
            break;
        }
    }

    const floorBonus = (Number(floor) - 1) * 5;
    const basePower = getRandomInt(selectedRarity.minStat, selectedRarity.maxStat) + floorBonus;

    const dungeonPrefix = dungeonId.charAt(0).toUpperCase() + dungeonId.slice(1);
    const itemName = `${selectedRarity.name} ${dungeonPrefix} ${randomType}`;

    const tokenURI = buildTokenURI({
        itemName,
        rarity: selectedRarity.name,
        power: basePower,
        floor,
        enhanceLevel: 0,
        imagePath
    });

    return {
        itemName,
        rarity: selectedRarity.name,
        basePower,
        power: basePower,
        enhanceLevel: 0,
        image: `https://gateway.pinata.cloud/ipfs/${imagePath}`,
        imagePath,
        tokenURI
    };
}

app.post('/api/roll-loot', (req, res) => {
    const { dungeonId = 'rangsit', floor = 1 } = req.body;
    if (!dungeonLootPools[dungeonId]) {
        return res.status(400).json({ error: "Dungeon not found" });
    }
    const rolled = rollSingleItem(dungeonId, floor);
    console.log(`🎲 สุ่มได้ (+0): ${rolled.itemName} (Power: ${rolled.power}, Floor: ${floor})`);
    res.json({ success: true, item: rolled });
});

app.post('/api/extract-loot', async (req, res) => {
    try {
        const { playerAddress, items = [] } = req.body;
        if (!playerAddress) return res.status(400).json({ error: "No player address provided" });

        if (!Array.isArray(items) || items.length === 0) {
            return res.json({ success: true, mintedItems: [], txHashes: [] });
        }

        console.log(`💰 กำลัง Extract & Mint ${items.length} ชิ้นให้: ${playerAddress}`);
        const mintedItems = [];
        const txHashes = [];

        for (const item of items) {
            const tx = await contract.mintItem(playerAddress, item.tokenURI);
            const receipt = await tx.wait();

            // ดึง tokenId จาก Event Transfer (args.tokenId)
            let mintedTokenId = null;
            for (const log of receipt.logs) {
                try {
                    const parsed = contract.interface.parseLog(log);
                    if (parsed && parsed.name === "Transfer" && parsed.args?.tokenId !== undefined) {
                        mintedTokenId = parsed.args.tokenId.toString();
                        break;
                    }
                } catch {
                    // ข้าม log ที่ไม่ใช่ของ contract นี้
                }
            }

            mintedItems.push({
                ...item,
                tokenId: mintedTokenId,
                enhanceLevel: 0,
                isStarter: false
            });
            txHashes.push(tx.hash);
            console.log(`✅ Mint สำเร็จ: ${item.itemName} (Token #${mintedTokenId}) Tx: ${tx.hash}`);
        }

        res.json({
            success: true,
            mintedItems,
            txHashes
        });
    } catch (error) {
        console.error("❌ Error extracting loot:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/upgrade-item', async (req, res) => {
    try {
        const {
            tokenId,
            itemName,
            rarity,
            power,
            floor = 1,
            enhanceLevel = 0,
            imagePath
        } = req.body;

        if (tokenId === undefined || tokenId === null) {
            return res.status(400).json({ error: "No tokenId provided" });
        }

        const newTokenURI = buildTokenURI({
            itemName,
            rarity,
            power,
            floor,
            enhanceLevel,
            imagePath
        });

        console.log(`🔨 กำลังอัปเดต Token #${tokenId} บน Sepolia -> ${itemName} (Power: ${power}, +${enhanceLevel})`);
        const tx = await contract.upgradeItem(tokenId, newTokenURI);
        await tx.wait();

        console.log(`✅ อัปเดต Token #${tokenId} สำเร็จ! Tx: ${tx.hash}`);
        res.json({
            success: true,
            tokenId,
            itemName,
            power,
            enhanceLevel,
            txHash: tx.hash
        });
    } catch (error) {
        console.error("❌ Error upgrading item on-chain:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/burn-item', async (req, res) => {
    try {
        const { tokenId } = req.body;
        if (tokenId === undefined || tokenId === null) {
            return res.status(400).json({ error: "No tokenId provided" });
        }

        console.log(`🔥 กำลังเผา Token #${tokenId} ทิ้งบน Sepolia...`);
        const tx = await contract.burnItem(tokenId);
        await tx.wait();

        console.log(`✅ Burn Token #${tokenId} สำเร็จ! Tx: ${tx.hash}`);
        res.json({
            success: true,
            tokenId,
            txHash: tx.hash
        });
    } catch (error) {
        console.error("❌ Error burning item on-chain:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Game Master Server running on port ${PORT}`);
});