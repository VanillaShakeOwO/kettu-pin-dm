import React from "react";
import { logger } from "@vendetta";
import { findByProps, findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { Forms } from "@vendetta/ui/components";
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
let storage: Store | undefined;
const unpatches: (() => void)[] = [];
function uuid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function ensureStorage() {
    if (!storage) {
        storage =
            ((window as any).vendetta?.plugin?.storage as Store) ?? {
                collections: [],
            };
    }
    storage.collections ??= [];
}
function showSheet(config: any) {
    const module = findByProps("showSimpleActionSheet");
    if (!module?.showSimpleActionSheet) {
        logger.error("[DM Collections] Action sheet API unavailable.");
        return;
    }
    module.showSimpleActionSheet(config);
}
function createCollection() {
    ensureStorage();
    const number = storage!.collections.length + 1;
    storage!.collections.push({
        id: uuid(),
        name: `Collection ${number}`,
        color: COLORS[0],
        dmIds: [],
    });
    logger.log(`[DM Collections] Created Collection ${number}.`);
    openCollectionsMenu();
}
function openColorPicker(collection: DMCollection) {
    showSheet({
        key: "DMCollectionsColor",
        header: {
            title: "Collection Color",
        },
        options: COLORS.map((color) => ({
            label: color,
            onPress: () => {
                collection.color = color;
            },
        })),
    });
}
function manageCollection(collection: DMCollection) {
    showSheet({
        key: "DMCollectionsCollection",
        header: {
            title: collection.name,
        },
        options: [
            {
                label: "Change Color",
                onPress: () => openColorPicker(collection),
            },
            {
                label: "Delete Collection",
                isDestructive: true,
                onPress: () => {
                    ensureStorage();
                    storage!.collections =
                        storage!.collections.filter(
                            (item) => item.id !== collection.id,
                        );
                },
            },
        ],
    });
}
function openCollectionsMenu() {
    ensureStorage();
    const options: any[] = [
        {
            label: "Create Collection",
            onPress: createCollection,
        },
    ];
    for (const collection of storage!.collections) {
        options.push({
            label: `${collection.name} • ${collection.dmIds.length}`,
            onPress: () => manageCollection(collection),
        });
    }
    showSheet({
        key: "DMCollections",
        header: {
            title: "DM Collections",
        },
        options,
    });
}
/*
 * This creates the actual + button.
 *
 * Discord's mobile UI changes component names between versions,
 * so we look for common button/container components instead of
 * relying on one hard-coded internal component.
 */
function CollectionButton() {
    const { TouchableOpacity, View, Text } = ReactNative;
    return (
        <TouchableOpacity
            onPress={openCollectionsMenu}
            accessibilityLabel="DM Collections"
            style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Text
                style={{
                    fontSize: 28,
                    fontWeight: "300",
                }}
            >
                +
            </Text>
        </TouchableOpacity>
    );
}
/*
 * React Native is provided by Discord at runtime.
 */
const ReactNative = (() => {
    const rn = findByProps(
        "View",
        "Text",
        "TouchableOpacity",
    );
    return rn ?? {};
})();
/*
 * Try to find the DM home/header component and insert the
 * collection button into its children.
 */
function patchDMHome() {
    const candidates = [
        "PrivateChannels",
        "Friends",
        "Home",
        "ChannelList",
        "DirectMessages",
    ];
    for (const name of candidates) {
        try {
            const component = findByName(name);
            if (!component) continue;
            const patch = after(
                "render",
                component.prototype,
                (args: any[], ret: any) => {
                    try {
                        if (!ret?.props) return;
                        const children = ret.props.children;
                        if (!Array.isArray(children)) return;
                        if (
                            children.some(
                                (child: any) =>
                                    child?.type === CollectionButton,
                            )
                        ) {
                            return;
                        }
                        /*
                         * Put the + button near the top of the DM
                         * navigation controls.
                         */
                        children.splice(
                            Math.min(2, children.length),
                            0,
                            React.createElement(CollectionButton, {
                                key: "dm-collections-button",
                            }),
                        );
                    } catch (error) {
                        logger.error(
                            "[DM Collections] Failed to insert + button.",
                            error,
                        );
                    }
                },
            );
            if (patch) {
                logger.log(
                    `[DM Collections] Patched ${name}.`,
                );
                return patch;
            }
        } catch {}
    }
    logger.error(
        "[DM Collections] Could not find the Discord DM home component.",
    );
    return () => {};
}
export default {
    onLoad: () => {
        ensureStorage();
        try {
            const patch = patchDMHome();
            if (patch) {
                unpatches.push(patch);
            }
            logger.log(
                "[DM Collections] Loaded with + button.",
            );
        } catch (error) {
            logger.error(
                "[DM Collections] Failed to load.",
                error,
            );
        }
    },
    onUnload: () => {
        for (const unpatch of unpatches.splice(0)) {
            try {
                unpatch();
            } catch {}
        }
        logger.log(
            "[DM Collections] Unloaded.",
        );
    },
};
