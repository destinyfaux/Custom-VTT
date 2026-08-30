// client/src/components/character/GearModal.jsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { socket } from '../../socket';
import srd from '../../data/srd_data.json';
import { SERVER_URL } from '../../config';
import MonsterStatBlock from '../MonsterStatBlock';
import soundSynthesizer from '../../utils/SoundSynthesizer';
import { 
    calculateLiveStats, 
    calculateEncumbrance, 
    getPushDragLift, 
    parseWeight, 
    findItemInSRD 
} from '../../utils/CharacterEngine';
import { parseCoinValue, applyCurrencyDelta, getSellPrice } from '../../utils/inventoryCommerce';

// Helper to convert monster size string to grid multiplier
const getSizeMultiplier = (sizeStr) => {
    switch (sizeStr?.toLowerCase()) {
        case 'tiny': return 0.5;
        case 'small': return 0.75;
        case 'medium': return 1;
        case 'large': return 2;
        case 'huge': return 3;
        default: return 1;
    }
};

// Helper to convert a currency object to total copper pieces
const toTotalCp = (currency) => {
    return (currency.pp || 0) * 1000 +
           (currency.gp || 0) * 100 +
           (currency.ep || 0) * 50 +
           (currency.sp || 0) * 10 +
           (currency.cp || 0) +
           (currency.sk || 0) * 0.5; // if 'sk' (silver kings) are used
};

export default function GearModal({ data, update, onClose, role, targetUserId }) {
    const [activeCategory, setActiveCategory] = useState('weapons');
    const [search, setSearch] = useState('');
    const [beasts, setBeasts] = useState({});
    const [allMonsters, setAllMonsters] = useState({});   // full monster SRD for lookup
    const [selectedPetStats, setSelectedPetStats] = useState(null);
    const [hiddenCatalogItems, setHiddenCatalogItems] = useState([]);

    useEffect(() => {
        const handleInit = (state) => {
            setHiddenCatalogItems(state.hiddenCatalogItems || []);
        };
        const handleUpdate = (state) => {
            setHiddenCatalogItems(state.hiddenCatalogItems || []);
        };

        socket.on('init_state', handleInit);
        socket.on('state_update', handleUpdate);

        // Instantly synchronize current catalog visibility settings
        socket.emit('request_full_state');

        return () => {
            socket.off('init_state', handleInit);
            socket.off('state_update', handleUpdate);
        };
    }, []);

    const effectiveUserId = targetUserId || socket.auth.userId;
    console.log(`[GearModal] effectiveUserId: ${effectiveUserId} (targetUserId: ${targetUserId}, myId: ${socket.auth.userId})`);

    // Normalize local character state
    const [localData, setLocalData] = useState(() => {
        if (data) return data;
        try {
            return JSON.parse(localStorage.getItem('tome_data') || '{}');
        } catch { return {}; }
    });

    useEffect(() => {
        if (data) setLocalData(data);
    }, [data]);

    // Ensure every inventory item has a unique id (fix for old data)
    useEffect(() => {
        if (localData.inventory) {
            let needsUpdate = false;
            const updatedInventory = localData.inventory.map(item => {
                if (!item.id) {
                    needsUpdate = true;
                    return { ...item, id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6) };
                }
                return item;
            });
            if (needsUpdate) {
                handleUpdate('inventory', updatedInventory);
            }
        }
    }, [localData.inventory]);

    // Fetch Monster SRD (full list and beast subset)
    useEffect(() => {
        fetch(`${SERVER_URL}/api/monsters`)
            .then(r => r.json())
            .then(res => {
                const monsters = res.monsters || {};
                setAllMonsters(monsters);
                const beastList = {};
                Object.entries(monsters).forEach(([name, m]) => {
                    if (m.type?.toLowerCase().includes('beast')) {
                        beastList[name] = m;
                    }
                });
                setBeasts(beastList);
            })
            .catch(err => console.error("Error loading monster library:", err));
    }, []);

    const handleUpdate = (key, value) => {
        if (update) {
            update(key, value);
        } else {
            const updated = { ...localData, [key]: value };
            setLocalData(updated);
            localStorage.setItem('tome_data', JSON.stringify(updated));
            socket.emit('sync_character_data', updated);
        }
    };

    // ---------- Batching Queue ----------
    const inventoryQueue = useRef([]);
    const flushTimeout = useRef(null);
    const BATCH_THRESHOLD = 5;
    const BATCH_DELAY = 400;

    const flushInventoryQueue = useCallback(() => {
        if (inventoryQueue.current.length === 0) {
            flushTimeout.current = null;
            return;
        }
        const ops = [...inventoryQueue.current];
        inventoryQueue.current = [];
        flushTimeout.current = null;

        socket.emit('batch_inventory', {
            characterId: effectiveUserId,
            operations: ops
        }, (response) => {
            if (!response || !response.success) {
                console.error('Batch inventory failed:', response?.error);
                alert('Inventory update failed. Please refresh your sheet.');
                socket.emit('request_full_state');
            }
        });
    }, [effectiveUserId]);

    const queueInventoryAction = useCallback((action, payload) => {
        const operation = { action, ...payload };
        inventoryQueue.current.push(operation);

        if (inventoryQueue.current.length >= BATCH_THRESHOLD) {
            if (flushTimeout.current) {
                clearTimeout(flushTimeout.current);
                flushTimeout.current = null;
            }
            flushInventoryQueue();
        } else if (!flushTimeout.current) {
            flushTimeout.current = setTimeout(() => {
                flushInventoryQueue();
            }, BATCH_DELAY);
        }
    }, [flushInventoryQueue]);

    // ---------- INVENTORY ACTIONS (no currency) ----------
    const handleAddItem = (item) => {
        if (item.itemType === 'pack') {
            // Packs are handled separately
            const inventory = [...(localData.inventory || [])];
            item.contents?.forEach(itemName => {
                const found = findItemInSRD(itemName, srd) || { name: itemName, weight: 0 };
                const existingIdx = inventory.findIndex(i => i.name === itemName);
                if (existingIdx !== -1) {
                    inventory[existingIdx].quantity = (inventory[existingIdx].quantity || 1) + 1;
                } else {
                    const newItem = {
                        id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        name: itemName,
                        type: found.type || 'gear',
                        weight: parseWeight(found.weight),
                        cost: found.cost || '—',
                        quantity: 1,
                        equipped: false
                    };
                    inventory.push(newItem);
                }
            });
            // Optimistic update
            handleUpdate('inventory', inventory);
            queueInventoryAction('addPack', { pack: item });
            return;
        }

        const inventory = localData.inventory || [];
        const existingIdx = inventory.findIndex(i => i.name === item.name);

        if (existingIdx !== -1) {
            // Item already exists – increment quantity
            const existingItem = inventory[existingIdx];
            const newInventory = [...inventory];
            newInventory[existingIdx].quantity = (existingItem.quantity || 1) + 1;
            handleUpdate('inventory', newInventory);
            queueInventoryAction('adjustQuantity', { itemId: existingItem.id, delta: 1 });
        } else {
            // Updated item mapping to retain magical weapon properties
            const newItem = {
                id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 5),
                name: item.name,
                type: item.itemType || 'gear',
                weight: parseWeight(item.weight),
                cost: item.cost || item.value || '—',
                quantity: 1,
                equipped: false,
                damage: item.damage || null,
                damage_type: item.damage_type || null,
                rarity: item.rarity || null,
                magic_damage: item.magic_damage || null,
                magic_damage_type: item.magic_damage_type || null,
                properties: item.properties || null,
                ac: item.ac || null,
                dex_bonus: item.dex_bonus || null,
                max_dex_bonus: item.max_dex_bonus || null,
                ac_bonus: item.ac_bonus || null
            };
            const newInventory = [...inventory, newItem];
            handleUpdate('inventory', newInventory);
            queueInventoryAction('addItem', { item: newItem });
        }
    };

    const adjustQty = (id, delta) => {
        const inventory = (localData.inventory || []).map(item => {
            if (item.id === id) {
                const q = Math.max(0, (item.quantity || 1) + delta);
                return { ...item, quantity: q };
            }
            return item;
        }).filter(item => item.quantity > 0);
        handleUpdate('inventory', inventory);
        queueInventoryAction('adjustQuantity', { itemId: id, delta });
    };

    const handleRemoveItem = (id) => {
        const inventory = (localData.inventory || []).filter(item => item.id !== id);
        handleUpdate('inventory', inventory);
        queueInventoryAction('removeItem', { itemId: id });
    };

    const toggleEquip = (id) => {
        const inventory = (localData.inventory || []).map(item => {
            if (item.id === id) {
                if (item.type === 'armor' && !item.equipped) {
                    // Unequip any other armor
                    return { ...item, equipped: true };
                }
                return { ...item, equipped: !item.equipped };
            }
            if (item.type === 'armor' && itemIdMatchesArmor(id)) {
                return { ...item, equipped: false };
            }
            return item;
        });
        handleUpdate('inventory', inventory);
        queueInventoryAction('toggleEquip', { itemId: id });
    };

    const itemIdMatchesArmor = (id) => {
        const target = (localData.inventory || []).find(i => i.id === id);
        return target && target.type === 'armor';
    };

    // ---------- BUY & SELL (with currency) ----------
    const handleBuyItem = (item) => {
        // Attach monsterData if this is a mount or pet
        let monsterData = null;
        if (item.itemType === 'mount' || item.type === 'mount') {
            const found = allMonsters[item.name];
            if (found) monsterData = found;
        }

        // Calculate cost in CP
        const costInCp = parseCoinValue(item.cost || item.value || 0);

        // If the item is free (cost <= 0), skip the currency check
        if (costInCp <= 0) {
            // Build the new item (free)
            const newItem = {
                id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 5),
                name: item.name,
                type: item.itemType || item.type || 'gear',
                weight: parseWeight(item.weight),
                cost: item.cost || item.value || '—',
                quantity: 1,
                equipped: false,
                damage: item.damage || null,
                damage_type: item.damage_type || null,
                rarity: item.rarity || null,
                magic_damage: item.magic_damage || null,
                magic_damage_type: item.magic_damage_type || null,
                properties: item.properties || null,
                ac: item.ac || null,
                dex_bonus: item.dex_bonus || null,
                max_dex_bonus: item.max_dex_bonus || null,
                ac_bonus: item.ac_bonus || null,
                monsterData: monsterData
            };

            const nextData = {
                ...localData,
                inventory: [...(localData.inventory || []), newItem]
            };
            setLocalData(nextData);
            localStorage.setItem('tome_data', JSON.stringify(nextData));
            queueInventoryAction('buyItem', { item: newItem, currency: null });
            return;
        }

        const currentCurrency = {
            pp: localData.pp || 0,
            gp: localData.gp || 0,
            ep: localData.ep || 0,
            sp: localData.sp || 0,
            cp: localData.cp || 0,
            sk: localData.sk || 0
        };

        // ---- ROBUST FUNDS CHECK using total CP ----
        const totalCp = toTotalCp(currentCurrency);
        if (totalCp < costInCp) {
            alert('You do not have enough funds to purchase that item.');
            return;
        }

        // Now apply the delta
        const currencyAfterPurchase = applyCurrencyDelta(currentCurrency, costInCp, 'debit');

        // (Optional) double-check that no denomination went negative
        const hasFunds = currencyAfterPurchase.pp >= 0 && 
                         currencyAfterPurchase.gp >= 0 && 
                         currencyAfterPurchase.ep >= 0 && 
                         currencyAfterPurchase.sp >= 0 && 
                         currencyAfterPurchase.cp >= 0 && 
                         currencyAfterPurchase.sk >= 0;

        if (!hasFunds) {
            alert('You do not have enough funds to purchase that item.');
            return;
        }

        // Build the new item
        const newItem = {
            id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 5),
            name: item.name,
            type: item.itemType || item.type || 'gear',
            weight: parseWeight(item.weight),
            cost: item.cost || item.value || '—',
            quantity: 1,
            equipped: false,
            damage: item.damage || null,
            damage_type: item.damage_type || null,
            rarity: item.rarity || null,
            magic_damage: item.magic_damage || null,
            magic_damage_type: item.magic_damage_type || null,
            properties: item.properties || null,
            ac: item.ac || null,
            dex_bonus: item.dex_bonus || null,
            max_dex_bonus: item.max_dex_bonus || null,
            ac_bonus: item.ac_bonus || null,
            monsterData: monsterData
        };

        // Build the complete new state
        const nextData = {
            ...localData,
            ...currencyAfterPurchase,
            inventory: [...(localData.inventory || []), newItem]
        };

        setLocalData(nextData);
        localStorage.setItem('tome_data', JSON.stringify(nextData));
        queueInventoryAction('buyItem', { item: newItem, currency: currencyAfterPurchase });
    };

    // ---------- SELL (with quantity support) ----------
    const handleSellItem = (item, quantity) => {
        // If quantity is not provided, ask the user
        if (quantity === undefined) {
            const currentQty = item.quantity || 1;
            if (currentQty > 1) {
                const input = window.prompt(`How many ${item.name} do you want to sell? (max ${currentQty})`, '1');
                if (input === null) return; // user cancelled
                const parsed = parseInt(input);
                if (isNaN(parsed) || parsed <= 0) {
                    alert('Please enter a valid positive number.');
                    return;
                }
                if (parsed > currentQty) {
                    alert(`You only have ${currentQty} of ${item.name}.`);
                    return;
                }
                quantity = parsed;
            } else {
                quantity = 1;
            }
        }

        // Ensure quantity is at least 1
        quantity = Math.min(quantity, item.quantity || 1);
        if (quantity <= 0) return;

        // Calculate total sell value
        const singleValue = getSellPrice(item);
        const totalValue = singleValue * quantity;

        // Build new inventory: reduce quantity or remove if it reaches zero
        let newInventory;
        if (quantity >= (item.quantity || 1)) {
            // Remove the entire stack
            newInventory = (localData.inventory || []).filter(entry => entry.id !== item.id);
        } else {
            // Reduce quantity
            newInventory = (localData.inventory || []).map(entry => {
                if (entry.id === item.id) {
                    return { ...entry, quantity: (entry.quantity || 1) - quantity };
                }
                return entry;
            });
        }

        // Calculate new currency
        const currentCurrency = {
            pp: localData.pp || 0,
            gp: localData.gp || 0,
            ep: localData.ep || 0,
            sp: localData.sp || 0,
            cp: localData.cp || 0,
            sk: localData.sk || 0
        };

        // We'll use applyCurrencyDelta with a credit
        const currencyAfter = applyCurrencyDelta(currentCurrency, totalValue, 'credit');

        const nextData = {
            ...localData,
            ...currencyAfter,
            inventory: newInventory
        };

        setLocalData(nextData);
        localStorage.setItem('tome_data', JSON.stringify(nextData));
        queueInventoryAction('sellItem', { itemId: item.id, quantity, currency: currencyAfter });
    };

    // ---------- PET ACTIONS (no currency) ----------
    const handleAddPet = (name, petData) => {
        const pets = localData.pets || [];
        const newPet = {
            id: 'pet_' + Date.now() + Math.random().toString(36).substr(2, 5),
            name: name,
            hpCur: petData.hp || 10,
            hpMax: petData.hp || 10,
            ac: petData.ac || 10,
            monsterData: petData
        };
        const newPets = [...pets, newPet];
        handleUpdate('pets', newPets);
        queueInventoryAction('addPet', { pet: newPet });
    };

    const adjustPetHP = (id, delta) => {
        const pets = (localData.pets || []).map(p => {
            if (p.id === id) {
                return { ...p, hpCur: Math.min(p.hpMax, Math.max(0, p.hpCur + delta)) };
            }
            return p;
        });
        handleUpdate('pets', pets);
        queueInventoryAction('adjustPetHP', { petId: id, delta });
    };

    const handleRemovePet = (id) => {
        const pets = (localData.pets || []).filter(p => p.id !== id);
        handleUpdate('pets', pets);
        queueInventoryAction('removePet', { petId: id });
    };

    // ---------- DEPLOY OWNED TOKEN (mount or pet) ----------
    const handleDeployOwned = (itemOrPet) => {
        // Determine if it's a pet (has monsterData directly) or a mount (item.monsterData)
        const monsterData = itemOrPet.monsterData || null;
        const name = itemOrPet.name;
        const hp = itemOrPet.hpCur || itemOrPet.hpMax || 10;
        const ac = itemOrPet.ac || 10;
        const size = monsterData?.size ? getSizeMultiplier(monsterData.size) : 1;

        // Emit spawn event; server will place near the player's own token
        socket.emit('spawn_owned_token', {
            name,
            avatarUrl: null,   // optionally set a default icon later
            hp,
            ac,
            monsterData,
            size,
        });

        soundSynthesizer.playUIClick();
    };

    // ---------- UI HELPERS (unchanged) ----------
    const liveStats = calculateLiveStats(localData);
    const encumbrance = calculateEncumbrance(localData, liveStats);
    const pushDrag = getPushDragLift(liveStats.str || 10);

    // Flattening and caching SRD lists
    const srdWeapons = useMemo(() => {
        if (!srd.equipment?.weapons) return [];
        return Object.entries(srd.equipment.weapons).flatMap(([category, items]) => 
            items.map(item => ({ ...item, category, itemType: 'weapon' }))
        );
    }, []);

    const srdArmor = useMemo(() => {
        if (!srd.equipment?.armor) return [];
        const list = [];
        ['light', 'medium', 'heavy'].forEach(type => {
            if (srd.equipment.armor[type]) {
                srd.equipment.armor[type].forEach(a => {
                    list.push({ ...a, category: type, itemType: 'armor' });
                });
            }
        });
        if (srd.equipment.armor.shields) {
            srd.equipment.armor.shields.forEach(s => {
                list.push({ ...s, name: s.name || 'Shield', category: 'shield', itemType: 'shield' });
            });
        }
        return list;
    }, []);

    // ★ EXPANDED SRD ITEMS: Adventuring Gear, Packs, Tools (all types), Trade Goods
    const srdItems = useMemo(() => {
        const items = [];

        // 1. Adventuring Gear
        if (srd.equipment?.adventuring_gear && Array.isArray(srd.equipment.adventuring_gear)) {
            srd.equipment.adventuring_gear.forEach(gear => {
                items.push({
                    ...gear,
                    itemType: 'gear',
                    type: 'gear'
                });
            });
        }

        // 2. Packs (special handling – they trigger addPack, but still appear in Items tab)
        if (srd.equipment?.packs) {
            Object.entries(srd.equipment.packs).forEach(([name, packData]) => {
                items.push({
                    name,
                    ...packData,
                    itemType: 'pack',
                    type: 'pack'
                });
            });
        }

        // 3. Tools – flatten all subcategories
        if (srd.equipment?.tools) {
            const toolCategories = ['artisan_tools', 'gaming_sets', 'instruments', 'other_tools'];
            toolCategories.forEach(cat => {
                const toolsArray = srd.equipment.tools[cat];
                if (Array.isArray(toolsArray)) {
                    toolsArray.forEach(tool => {
                        items.push({
                            ...tool,
                            itemType: 'tool',
                            type: 'tool',
                            category: cat
                        });
                    });
                }
            });
        }

        // 4. Trade Goods
        if (srd.equipment?.trade_goods && Array.isArray(srd.equipment.trade_goods)) {
            srd.equipment.trade_goods.forEach(good => {
                items.push({
                    ...good,
                    itemType: 'trade_good',
                    type: 'trade_good'
                });
            });
        }

        return items;
    }, []);

    // ★ FIXED: Mounts & Vehicles – now correctly reads from srd.equipment and includes tack_harness_and_drawn_vehicles
    const srdMounts = useMemo(() => {
        const mounts = [];
        // Main mounts and vehicles
        if (srd.equipment?.mounts_and_vehicles) {
            mounts.push(...srd.equipment.mounts_and_vehicles.map(item => ({
                ...item,
                itemType: 'mount',
                type: 'mount'
            })));
        }
        // Tack, harness, and drawn vehicles (often used alongside mounts)
        if (srd.equipment?.tack_harness_and_drawn_vehicles) {
            mounts.push(...srd.equipment.tack_harness_and_drawn_vehicles.map(item => ({
                ...item,
                itemType: 'mount',
                type: 'mount'
            })));
        }
        return mounts;
    }, []);

    // Catalog filtering memo: Restricts visibility based on hidden state and player role
    const availableCatalog = useMemo(() => {
        let list = [];
        if (activeCategory === 'weapons') list = srdWeapons;
        else if (activeCategory === 'items') list = srdItems;
        else if (activeCategory === 'equipped') list = srdArmor;
        else if (activeCategory === 'mounts') list = srdMounts;
        else if (activeCategory === 'pets') {
            let petList = Object.entries(beasts).map(([name, m]) => ({ name, ...m, itemType: 'companion' }));
            // Hide pet companions from players if marked hidden by the DM
            if (role !== 'DM') {
                petList = petList.filter(m => !hiddenCatalogItems.includes(m.name));
            }
            return petList
                .filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()))
                .sort((a,b) => a.name.localeCompare(b.name));
        }

        // Hide weapons/armor/gear from players if marked hidden by the DM
        if (role !== 'DM') {
            list = list.filter(item => !hiddenCatalogItems.includes(item.name));
        }

        if (search) {
            list = list.filter(item => item.name?.toLowerCase().includes(search.toLowerCase()));
        }
        return list.sort((a, b) => a.name?.localeCompare(b.name));
    }, [activeCategory, srdWeapons, srdItems, srdArmor, srdMounts, beasts, search, hiddenCatalogItems, role]);

    // Filter player's owned items based on activeCategory
    const ownedList = useMemo(() => {
        const inventory = localData.inventory || [];
        if (activeCategory === 'weapons') return inventory.filter(i => i.type === 'weapon');
        if (activeCategory === 'items') return inventory.filter(i => i.type === 'gear' || i.type === 'tool' || i.type === 'trade_good');
        if (activeCategory === 'equipped') return inventory.filter(i => i.type === 'armor' || i.type === 'shield');
        if (activeCategory === 'mounts') return inventory.filter(i => i.type === 'mount');
        if (activeCategory === 'pets') return localData.pets || [];
        return [];
    }, [localData.inventory, localData.pets, activeCategory]);

    const getCatalogKey = (item) => {
        if (activeCategory === 'pets') return item.name;
        return `${item.name}_${item.itemType}_${item.category || ''}_${item.type || ''}`;
    };

    // ---------- RENDER ----------
    return (
        <div className="fixed inset-0 z-[1100] bg-black/80 flex items-center justify-center p-6 animate-in fade-in duration-200">
            {/* Global Beast Stat block pop-out overlay */}
            {selectedPetStats && (
                <MonsterStatBlock monster={selectedPetStats} onClose={() => setSelectedPetStats(null)} />
            )}

            <div className="bg-bgPanel border border-accentGold rounded-xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
                {/* Header Row */}
                <header className="bg-bgCard p-4 border-b border-borderDark flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🎒</span>
                        <h2 className="text-accentGold font-extrabold text-lg uppercase tracking-wider">
                            {localData.name || 'Adventurer'}'s Inventory Hub
                        </h2>
                    </div>
                    <button 
                        onClick={() => {
                            soundSynthesizer.playUIClick();
                            onClose();
                        }} 
                        className="text-textMuted hover:text-white text-2xl px-2"
                    >
                        ✕
                    </button>
                </header>

                {/* Horizontal Currency Tray */}
                <div className="bg-[#0b0c10] border-b border-borderDark p-3 flex flex-wrap justify-between items-center gap-4 shrink-0">
                    <div className="flex flex-wrap gap-3">
                        {[
                            { id: 'pp', color: 'border-blue-400 text-blue-300', label: 'PP' },
                            { id: 'gp', color: 'border-yellow-500 text-yellow-300', label: 'GP' },
                            { id: 'ep', color: 'border-teal-400 text-teal-300', label: 'EP' },
                            { id: 'sp', color: 'border-gray-400 text-gray-300', label: 'SP' },
                            { id: 'cp', color: 'border-orange-500 text-orange-400', label: 'CP' },
                            { id: 'sk', color: 'border-purple-500 text-purple-300', label: 'SK' } 
                        ].map(coin => (
                            <div key={coin.id} className={`flex items-center bg-bgCard border rounded-lg px-2 py-1 gap-1.5 ${coin.color}`}>
                                <span className="text-[10px] font-bold uppercase tracking-wider">{coin.label}</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={localData[coin.id] ?? 0}
                                    onChange={e => {
                                        const newVal = Math.max(0, parseInt(e.target.value) || 0);
                                        const oldVal = localData[coin.id] ?? 0;
                                        if (newVal > oldVal) {
                                            soundSynthesizer.playGoldClink();
                                        } else {
                                            soundSynthesizer.playUIClick();
                                        }
                                        handleUpdate(coin.id, newVal);
                                    }}
                                    className="w-16 bg-transparent text-white font-extrabold text-sm text-center outline-none focus:text-accentGold transition-colors"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Weight Gauges */}
                    <div className="flex gap-6 text-[11px] text-textMuted">
                        <div>
                            Weight:{' '}
                            <span className={encumbrance.isEncumbered ? 'text-red-500 font-bold' : 'text-white'}>
                                {encumbrance.totalWeight}
                            </span>{' '}
                            / {encumbrance.capacity} lbs
                        </div>
                        <div>
                            Push/Drag/Lift: <span className="text-white">{pushDrag.pushDragLift} lbs</span>
                        </div>
                    </div>
                </div>

                {/* Left/Right Columns content block */}
                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT: Category Selection + SRD Search Browser */}
                    <div className="w-1/2 border-r border-borderDark flex flex-col bg-bgCard/30">
                        {/* Tab Selector */}
                        <div className="grid grid-cols-5 border-b border-borderDark text-center">
                            {[
                                { id: 'weapons', label: 'WEAPONS' },
                                { id: 'items', label: 'ITEMS' },
                                { id: 'equipped', label: 'EQUIPPED' },
                                { id: 'mounts', label: 'MOUNTS' },
                                { id: 'pets', label: 'COMPANIONS' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => { 
                                        soundSynthesizer.playUIClick();
                                        setActiveCategory(tab.id); 
                                        setSearch(''); 
                                    }}
                                    className={`py-2 text-[10px] font-bold tracking-wider border-b-2 transition-all ${
                                        activeCategory === tab.id 
                                            ? 'border-accentGold text-accentGold bg-bgCard' 
                                            : 'border-transparent text-textMuted hover:text-white hover:bg-bgCard/50'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Search Input */}
                        <div className="p-3 border-b border-borderDark bg-[#0b0c10]">
                            <input
                                type="text"
                                placeholder={`Search catalog ${activeCategory}...`}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-bgCard text-white text-xs border border-borderDark rounded p-2 focus:border-accentGold outline-none"
                            />
                        </div>

                        {/* Scrolling Catalog List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#0b0c10]">
                            {availableCatalog.map(item => {
                                const isHidden = hiddenCatalogItems.includes(item.name);
                                return (
                                    <div 
                                        key={getCatalogKey(item)} 
                                        className={`bg-bgCard p-2.5 rounded border flex justify-between items-center text-xs group hover:border-accentGold/50 transition-all ${
                                            isHidden 
                                                ? 'border-dashed border-red-500/40 opacity-70 bg-bgPanel/30' 
                                                : 'border-borderDark'
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0 pr-2">
                                            <div className="font-bold text-white truncate flex items-center gap-1.5">
                                                {item.name}
                                                {item.damage && <span className="text-accentGold text-[10px]">({item.damage})</span>}
                                                {item.ac && <span className="text-green-400 text-[10px]">(AC {item.ac})</span>}
                                                {isHidden && <span className="text-[8px] bg-red-950 text-red-400 border border-red-900 px-1 rounded uppercase tracking-wider font-bold select-none">Hidden</span>}
                                            </div>
                                            <div className="text-[10px] text-textMuted mt-0.5 truncate">
                                                {activeCategory === 'pets' 
                                                    ? `CR ${item.challenge_rating} Beast` 
                                                    : `Weight: ${item.weight || '0'} lbs • Cost: ${item.cost || item.value || '—'}`
                                                }
                                            </div>
                                        </div>

                                        <div className="flex items-center shrink-0">
                                            {/* DM-Only Visibility Toggle Button */}
                                            {role === 'DM' && (
                                                <button
                                                    onClick={() => {
                                                        soundSynthesizer.playUIClick();
                                                        socket.emit('toggle_catalog_hidden', item.name);
                                                    }}
                                                    className={`p-1.5 text-xs mr-2 transition-all rounded bg-bgPanel border border-borderDark/80 hover:border-accentGold flex items-center justify-center leading-none ${
                                                        isHidden 
                                                            ? 'text-red-500 opacity-100 hover:text-red-400' 
                                                            : 'text-textMuted opacity-50 hover:opacity-100 hover:text-white'
                                                    }`}
                                                    title={isHidden ? 'Hidden from Players (Click to Reveal)' : 'Visible to Players (Click to Hide)'}
                                                >
                                                    {isHidden ? '🔒' : '👁️'}
                                                </button>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {activeCategory !== 'pets' && (
                                                    <button
                                                        onClick={() => {
                                                            soundSynthesizer.playUIClick();
                                                            handleBuyItem(item);
                                                        }}
                                                        className="bg-emerald-600 text-white font-extrabold px-3 py-1.5 rounded hover:bg-emerald-500 text-[10px] uppercase tracking-wider transition-colors"
                                                    >
                                                        BUY
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        soundSynthesizer.playUIClick();
                                                        activeCategory === 'pets' ? handleAddPet(item.name, item) : handleAddItem(item);
                                                    }}
                                                    className="bg-accentGold text-black font-extrabold px-3 py-1.5 rounded hover:bg-yellow-500 text-[10px] uppercase tracking-wider transition-colors"
                                                >
                                                    ADD
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT: Owned Inventory list */}
                    <div className="w-1/2 flex flex-col bg-[#0b0c10]">
                        <div className="p-3 border-b border-borderDark bg-bgCard font-bold text-[10px] text-accentGold uppercase tracking-widest shrink-0">
                            Your Owned {activeCategory}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0d0e12]">
                            {ownedList.length === 0 && (
                                <p className="text-xs text-textMuted italic text-center py-12">
                                    None currently in inventory. Click catalog [+] to add.
                                </p>
                            )}

                            {activeCategory !== 'pets' ? (
                                ownedList.map(item => {
                                    const totalWeight = parseFloat((parseWeight(item.weight) * (item.quantity || 1)).toFixed(2));
                                    const isMount = item.type === 'mount';
                                    const canDeploy = isMount && item.monsterData;
                                    return (
                                        <div key={item.id} className="bg-bgCard p-3 rounded border border-borderDark flex items-center justify-between gap-2 text-xs">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-white truncate flex items-center gap-1.5">
                                                    {item.name}
                                                    {/* Badges for tools and trade goods */}
                                                    {item.type === 'tool' && <span className="text-[8px] bg-blue-800 text-white px-1 rounded">Tool</span>}
                                                    {item.type === 'trade_good' && <span className="text-[8px] bg-emerald-800 text-white px-1 rounded">Trade</span>}
                                                    {item.equipped && <span className="bg-green-950 text-green-400 border border-green-800 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Worn</span>}
                                                    {isMount && <span className="text-[8px] bg-amber-800 text-white px-1 rounded">Mount</span>}
                                                </div>
                                                <div className="text-[10px] text-textMuted mt-0.5">
                                                    Weight: {totalWeight} lbs • {item.properties?.slice(0,2).join(', ')}
                                                </div>
                                            </div>

                                            {/* Deploy button for mounts with monsterData */}
                                            {canDeploy && (
                                                <button
                                                    onClick={() => handleDeployOwned(item)}
                                                    className="bg-blue-600 text-white px-2 py-1 rounded text-[9px] font-bold hover:bg-blue-500 transition-colors"
                                                >
                                                    Deploy
                                                </button>
                                            )}

                                            {/* Quantity adjusters & equip flags */}
                                            <div className="flex items-center gap-3 shrink-0">
                                                {(item.type === 'armor' || item.type === 'shield' || item.type === 'weapon') && (
                                                    <button
                                                        onClick={() => {
                                                            soundSynthesizer.playUIClick();
                                                            toggleEquip(item.id);
                                                        }}
                                                        className={`text-[9px] font-bold px-2 py-1 rounded transition-colors uppercase ${
                                                            item.equipped 
                                                                ? 'bg-green-700 text-white hover:bg-green-600' 
                                                                : 'bg-borderDark text-textLight hover:bg-gray-700'
                                                        }`}
                                                    >
                                                        {item.equipped ? 'Equipped' : 'Equip'}
                                                    </button>
                                                )}

                                                <div className="flex items-center bg-bgPanel border border-borderDark rounded overflow-hidden">
                                                    <button 
                                                        onClick={() => {
                                                            soundSynthesizer.playUIClick();
                                                            adjustQty(item.id, -1);
                                                        }} 
                                                        className="px-2 py-1 text-textMuted hover:text-white hover:bg-bgCard transition-colors font-bold"
                                                    >
                                                        −
                                                    </button>
                                                    <span className="px-3 font-extrabold text-white text-[11px]">{item.quantity || 1}</span>
                                                    <button 
                                                        onClick={() => {
                                                            soundSynthesizer.playUIClick();
                                                            adjustQty(item.id, 1);
                                                        }} 
                                                        className="px-2 py-1 text-textMuted hover:text-white hover:bg-bgCard transition-colors font-bold"
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                <button 
                                                    onClick={() => {
                                                        soundSynthesizer.playUIClick();
                                                        handleSellItem(item);
                                                    }} 
                                                    className="bg-amber-600 text-white px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider hover:bg-amber-500"
                                                >
                                                    Sell
                                                </button>

                                                <button 
                                                    onClick={() => {
                                                        soundSynthesizer.playUIClick();
                                                        handleRemoveItem(item.id);
                                                    }} 
                                                    className="text-red-950 hover:text-red-500 font-extrabold text-base px-1.5 transition-colors"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                ownedList.map(pet => {
                                    const canDeploy = pet.monsterData;
                                    return (
                                    <div key={pet.id} className="bg-bgCard p-3 rounded border border-borderDark flex items-center justify-between gap-2 text-xs">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white truncate">{pet.name}</div>
                                            <div className="text-[10px] text-accentGold font-bold mt-1">AC {pet.ac}</div>
                                        </div>

                                        {/* Deploy button for pets */}
                                        {canDeploy && (
                                            <button
                                                onClick={() => handleDeployOwned(pet)}
                                                className="bg-blue-600 text-white px-2 py-1 rounded text-[9px] font-bold hover:bg-blue-500 transition-colors"
                                            >
                                                Deploy
                                            </button>
                                        )}

                                        {/* HP & Actions */}
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] text-textMuted uppercase mr-1">HP</span>
                                                <div className="flex items-center bg-bgPanel border border-borderDark rounded overflow-hidden">
                                                        <button 
                                                            onClick={() => {
                                                                soundSynthesizer.playUIClick();
                                                                adjustPetHP(pet.id, -1);
                                                            }} 
                                                            className="px-1.5 py-0.5 text-textMuted hover:text-white hover:bg-bgCard"
                                                        >
                                                            -
                                                        </button>
                                                    <span className="px-2 font-bold text-white text-[10px]">{pet.hpCur}/{pet.hpMax}</span>
                                                        <button 
                                                            onClick={() => {
                                                                soundSynthesizer.playUIClick();
                                                                adjustPetHP(pet.id, 1);
                                                            }} 
                                                            className="px-1.5 py-0.5 text-textMuted hover:text-white hover:bg-bgCard"
                                                        >
                                                            +
                                                        </button>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    soundSynthesizer.playUIClick();
                                                    setSelectedPetStats(pet.monsterData);
                                                }}
                                                className="bg-borderDark hover:bg-gray-700 text-white text-[9px] font-bold px-2.5 py-1.5 rounded transition-colors uppercase"
                                            >
                                                View Stats
                                            </button>

                                                <button 
                                                    onClick={() => {
                                                        soundSynthesizer.playUIClick();
                                                        handleRemovePet(pet.id);
                                                    }} 
                                                    className="text-red-950 hover:text-red-500 font-extrabold text-base px-1.5 transition-colors"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}