import { logger } from "@vendetta";
import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showInputAlert } from "@vendetta/ui/alerts";
import { Forms } from "@vendetta/ui/components";
import { getAssetIDByName } from "@vendetta/ui/assets";

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
    "#5865F2", "#ED4245", "#57F287", "#FEE75C",
    "#EB459E", "#9B59B6", "#E67E22", "#1ABC9C",
];

let storage: Store;
let unpatches: (() => void)[] = [];

function uuid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ensureStorage() {
    storage ??= (window as any).vendetta?.plugin?.storage as Store;
    storage ??= { collections: [] };
    storage.collections ??= [];
}

function hideSheet() {
    try {
        const alerts = findByProps("openLazy", "hideActionSheet");
        alerts?.hideActionSheet?.();
    } catch {}
}

function openColorPicker(collection?: DMCollection, afterPick?: (color: string) => void) {
    const options = COLORS.map((color) => ({
        label: color,
        icon: undefined,
        onPress: () => {
            if (collection) collection.color = color;
            afterPick?.(color);
        },
    }));

    options.push({
        label: "Custom HEX…",
        icon: undefined,
        onPress: () => {
            showInputAlert({
                title: "Custom Collection Color",
                initialValue: collection?.color ?? "#5865F2",
                placeholder: "#5865F2",
                confirmText: "Save",
                cancelText: "Cancel",
                onConfirm: (value: string) => {
                    const color = value.trim();
                    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
                    if (collection) collection.color = color;
                    afterPick?.(color);
                },
            });
        },
    });

    const show = findByProps("showSimpleActionSheet")?.showSimpleActionSheet;
    if (!show) return;

    show({
        key: "DMCollectionsColor",
        header: { title: "Collection Color" },
        options,
    });
}

function createCollection() {
    ensureStorage();

    showInputAlert({
        title: "Create Collection",
        placeholder: "Collection name",
        confirmText: "Next",
        cancelText: "Cancel",
        onConfirm: (name: string) => {
            const trimmed = name.trim();
            if (!trimmed) return;

            const collection: DMCollection = {
                id: uuid(),
                name: trimmed,
                color: COLORS[0],
                dmIds: [],
            };

            storage.collections.push(collection);

            openColorPicker(collection, () => {
                logger.log(`[DM Collections] Created "${collection.name}"`);
            });
        },
    });
}

function manageCollections() {
    ensureStorage();

    if (!storage.collections.length) {
        createCollection();
        return;
    }

    const show = findByProps("showSimpleActionSheet")?.showSimpleActionSheet;
    if (!show) return;

    const options: any[] = storage.collections.map((collection) => ({
        label: `${collection.name}  •  ${collection.dmIds.length} DMs`,
        onPress: () => manageCollection(collection),
    }));

    options.push({
        label: "＋ Create Collection",
        onPress: createCollection,
    });

    show({
        key: "DMCollectionsManage",
        header: { title: "DM Collections" },
        options,
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
                label: "Rename",
                onPress: () => {
                    showInputAlert({
                        title: "Rename Collection",
                        initialValue: collection.name,
                        confirmText: "Save",
                        cancelText: "Cancel",
                        onConfirm: (name: string) => {
                            if (name.trim()) collection.name = name.trim();
                        },
                    });
                },
            },
            {
                label: "Change Color",
                onPress: () => openColorPicker(collection),
            },
            {
                label: "Delete Collection",
                isDestructive: true,
                onPress: () => {
                    storage.collections = storage.collections.filter((x) => x.id !== collection.id);
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
            label: "＋ Create Collection",
            onPress: createCollection,
        },
    ];

    for (const collection of storage.collections) {
        options.push({
            label: `${collection.name}  •  ${collection.dmIds.length}`,
            onPress: () => {
                // The actual DM list is intentionally handled by Discord's
                // navigation layer; this entry is the collection management
                // hook and can be extended with DM selection.
                manageCollection(collection);
            },
        });
    }

    options.push({
        label: "⚙ Manage Collections",
        onPress: manageCollections,
    });

    show({
        key: "DMCollections",
        header: { title: "DM Collections" },
        options,
    });
}

/**
 * Discord already uses showSimpleActionSheet for several long-press menus.
 * We augment the DM/navigation-button long-press sheet when its identifying
 * key/title matches. This avoids replacing the Discord navigation component.
 */
function patchDMButtonLongPress() {
    const module = findByProps("showSimpleActionSheet");
    if (!module?.showSimpleActionSheet) {
        logger.error("[DM Collections] Could not find showSimpleActionSheet.");
        return () => {};
    }

    return after("showSimpleActionSheet", module, (args: any[]) => {
        const sheet = args?.[0];
        if (!sheet) return;

        const key = String(sheet.key ?? "").toLowerCase();
        const title = String(sheet.header?.title ?? "").toLowerCase();

        const looksLikeLongPress =
            key.includes("longpress") ||
            key.includes("tab") ||
            key.includes("nav");

        const looksLikeDMButton =
            title.includes("direct message") ||
            title === "messages" ||
            title === "dms" ||
            title.includes("direct messages");

        if (!looksLikeLongPress && !looksLikeDMButton) return;

        if (sheet.__dmCollectionsInjected) return;
        sheet.__dmCollectionsInjected = true;

        sheet.options ??= [];

        sheet.options.unshift({
            label: "📁 Create Collection",
            onPress: createCollection,
        });

        if (storage?.collections?.length) {
            sheet.options.splice(1, 0, {
                label: "📌 DM Collections",
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
            logger.log("[DM Collections] Loaded.");
        } catch (e) {
            logger.error("[DM Collections] Failed to load.", e);
        }
    },

    onUnload: () => {
        for (const unpatch of unpatches.splice(0)) {
            try { unpatch(); } catch {}
        }
        logger.log("[DM Collections] Unloaded.");
    },

    settings: () => (
        <Forms.FormSection title="DM Collections">
            <Forms.FormRow
                label="Create Collection"
                leading={<Forms.FormRow.Icon source={getAssetIDByName("ic_add_24px")} />}
                onPress={createCollection}
            />
            <Forms.FormRow
                label="Manage Collections"
                leading={<Forms.FormRow.Icon source={getAssetIDByName("settings")} />}
                onPress={manageCollections}
            />
        </Forms.FormSection>
    ),
};
