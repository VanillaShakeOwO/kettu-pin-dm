import { logger } from "@vendetta";
import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";

type DMCollection = {
    id: string;
    name: string;
    color: string;
    dmIds: string[];
};

type Store = {
    collections: DMCollection[];
};

const COLORS = [
    "#5865F2",
    "#ED4245",
    "#57F287",
    "#FEE75C",
    "#EB459E",
    "#9B59B6",
    "#E67E22",
    "#1ABC9C",
];

let storage: Store;
const unpatches: (() => void)[] = [];

function uuid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ensureStorage() {
    storage ??= (window as any).vendetta?.plugin?.storage as Store;

    if (!storage) storage = { collections: [] };
    storage.collections ??= [];
}

function createCollection() {
    ensureStorage();

    const number = storage.collections.length + 1;

    const collection: DMCollection = {
        id: uuid(),
        name: `Collection ${number}`,
        color: COLORS[0],
        dmIds: [],
    };

    storage.collections.push(collection);

    logger.log(`[DM Collections] Created "${collection.name}".`);
    openCollectionsMenu();
}

function openColorPicker(collection: DMCollection) {
    const show = findByProps("showSimpleActionSheet")?.showSimpleActionSheet;
    if (!show) return;

    show({
        key: "DMCollectionsColor",
        header: { title: "Collection Color" },
        options: COLORS.map((color) => ({
            label: color,
            onPress: () => {
                collection.color = color;
            },
        })),
    });
}

function manageCollection(collection: DMCollection) {
    const show = findByProps("showSimpleActionSheet")?.showSimpleActionSheet;
    if (!show) return;

    show({
        key: "DMCollectionsCollection",
        header: { title: collection.name },
        options: [
            {
                label: "Change Color",
                onPress: () => openColorPicker(collection),
            },
            {
                label: "Delete Collection",
                isDestructive: true,
                onPress: () => {
                    storage.collections = storage.collections.filter(
                        (item) => item.id !== collection.id,
                    );
                },
            },
        ],
    });
}

function openCollectionsMenu() {
    ensureStorage();

    const show = findByProps("showSimpleActionSheet")?.showSimpleActionSheet;
    if (!show) return;

    const options: any[] = [
        {
            label: "Create Collection",
            onPress: createCollection,
        },
    ];

    for (const collection of storage.collections) {
        options.push({
            label: `${collection.name} • ${collection.dmIds.length}`,
            onPress: () => manageCollection(collection),
        });
    }

    show({
        key: "DMCollections",
        header: { title: "DM Collections" },
        options,
    });
}

function patchDMButtonLongPress() {
    const module = findByProps("showSimpleActionSheet");

    if (!module?.showSimpleActionSheet) {
        logger.error("[DM Collections] Could not find showSimpleActionSheet.");
        return () => {};
    }

    return after("showSimpleActionSheet", module, (args: any[]) => {
        const sheet = args?.[0];

        if (!sheet || sheet.__dmCollectionsInjected) return;

        if (!Array.isArray(sheet.options)) return;

        sheet.__dmCollectionsInjected = true;

        sheet.options.unshift({
            label: "Create Collection",
            onPress: createCollection,
        });

        if (storage?.collections?.length) {
            sheet.options.splice(1, 0, {
                label: "DM Collections",
                onPress: openCollectionsMenu,
            });
        }
    });
}

export default {
    onLoad: () => {
        ensureStorage();

        try {
            const patch = patchDMButtonLongPress();
            unpatches.push(patch);
            logger.log("[DM Collections] Loaded successfully.");
        } catch (error) {
            logger.error("[DM Collections] Failed to load.", error);
        }
    },

    onUnload: () => {
        for (const unpatch of unpatches.splice(0)) {
            try {
                unpatch();
            } catch {}
        }

        logger.log("[DM Collections] Unloaded.");
    },
};
