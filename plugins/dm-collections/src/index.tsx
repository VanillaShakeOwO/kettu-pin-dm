import { logger } from "@vendetta";
import { findAll, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { TouchableOpacity, Text } from "react-native";

type DMCollection = {
    id: string;
    name: string;
    color: string;
    dmIds: string[];
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

const cleanups: (() => void)[] = [];
let patched = false;

function ensureStorage() {
    const s = storage as any;
    s.collections ??= [];
    return s as { collections: DMCollection[] };
}

function uuid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createCollection() {
    const s = ensureStorage();

    const number = s.collections.length + 1;

    s.collections.push({
        id: uuid(),
        name: `Collection ${number}`,
        color: COLORS[0],
        dmIds: [],
    });

    logger.log(`[DM Collections] Created Collection ${number}`);
}

function openCollectionsMenu() {
    const s = ensureStorage();

    const show =
        findByProps("showSimpleActionSheet")?.showSimpleActionSheet;

    if (!show) return;

    const options: any[] = [
        {
            label: "Create Collection",
            onPress: createCollection,
        },
    ];

    for (const collection of s.collections) {
        options.push({
            label: `${collection.name} • ${collection.dmIds.length}`,
            onPress: () => manageCollection(collection),
        });
    }

    show({
        key: "DMCollections",
        header: {
            title: "DM Collections",
        },
        options,
    });
}

function manageCollection(collection: DMCollection) {
    const show =
        findByProps("showSimpleActionSheet")?.showSimpleActionSheet;

    if (!show) return;

    show({
        key: "DMCollectionsManage",
        header: {
            title: collection.name,
        },
        options: [
            {
                label: "Change Color",
                onPress: () => {
                    const colorShow =
                        findByProps("showSimpleActionSheet")
                            ?.showSimpleActionSheet;

                    if (!colorShow) return;

                    colorShow({
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
                },
            },
            {
                label: "Delete Collection",
                isDestructive: true,
                onPress: () => {
                    const s = ensureStorage();

                    s.collections = s.collections.filter(
                        (x) => x.id !== collection.id,
                    );
                },
            },
        ],
    });
}

function CollectionButton() {
    return (
        <TouchableOpacity
            onPress={openCollectionsMenu}
            accessibilityLabel="DM Collections"
            accessibilityRole="button"
            style={{
                width: 52,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Text
                style={{
                    fontSize: 30,
                    fontWeight: "300",
                }}
            >
                +
            </Text>
        </TouchableOpacity>
    );
}

function containsAddFriends(node: any): boolean {
    if (node == null) return false;

    if (typeof node === "string") {
        return node.toLowerCase().includes("add friends");
    }

    if (Array.isArray(node)) {
        return node.some(containsAddFriends);
    }

    if (React.isValidElement(node)) {
        return containsAddFriends(node.props?.children);
    }

    return false;
}

function isAddFriendsButton(node: any): boolean {
    if (!React.isValidElement(node)) return false;

    const props = node.props ?? {};

    const label = String(
        props.accessibilityLabel ??
        props.label ??
        "",
    ).toLowerCase();

    if (label.includes("add friends")) return true;

    return (
        typeof props.onPress === "function" &&
        containsAddFriends(props.children)
    );
}

function transformNode(node: any, inserted: { value: boolean }): any {
    if (!React.isValidElement(node)) return node;

    const children = node.props?.children;

    if (Array.isArray(children)) {
        const output: any[] = [];

        for (const child of children) {
            if (
                !inserted.value &&
                isAddFriendsButton(child)
            ) {
                output.push(
                    React.createElement(CollectionButton, {
                        key: "dm-collections-plus",
                    }),
                );

                inserted.value = true;
            }

            output.push(transformNode(child, inserted));
        }

        return React.cloneElement(node, {
            children: output,
        });
    }

    if (children != null) {
        return React.cloneElement(node, {
            children: transformNode(children, inserted),
        });
    }

    return node;
}

function patchHomePanel(mod: any): boolean {
    const exported = mod?.HomePanelContent;

    if (!exported) return false;

    // Normal function component
    if (typeof exported === "function") {
        if (mod.__dmCollectionsPatched) return false;

        const original = exported;

        mod.HomePanelContent = function DMCollectionsHomePanel(
            props: any,
        ) {
            const result = original(props);

            const inserted = { value: false };

            return transformNode(result, inserted);
        };

        mod.__dmCollectionsPatched = true;

        cleanups.push(() => {
            mod.HomePanelContent = original;
            delete mod.__dmCollectionsPatched;
        });

        return true;
    }

    // React.memo / wrapped component
    if (
        typeof exported === "object" &&
        typeof exported.type === "function"
    ) {
        if (exported.__dmCollectionsPatched) return false;

        const original = exported.type;

        exported.type = function DMCollectionsHomePanel(
            props: any,
        ) {
            const result = original(props);

            const inserted = { value: false };

            return transformNode(result, inserted);
        };

        exported.__dmCollectionsPatched = true;

        cleanups.push(() => {
            exported.type = original;
            delete exported.__dmCollectionsPatched;
        });

        return true;
    }

    return false;
}

function findAndPatchHomePanel() {
    try {
        const modules = findAll(
            (m: any) =>
                m?.HomePanelContent &&
                (
                    typeof m.HomePanelContent === "function" ||
                    typeof m.HomePanelContent === "object"
                ),
        );

        for (const mod of modules) {
            if (patchHomePanel(mod)) {
                logger.log(
                    "[DM Collections] HomePanelContent patched.",
                );
                patched = true;
            }
        }
    } catch (error) {
        logger.error(
            "[DM Collections] Failed to patch HomePanelContent.",
            error,
        );
    }

    return patched;
}

export default {
    onLoad() {
        ensureStorage();

        findAndPatchHomePanel();

        let attempts = 0;

        const timer = setInterval(() => {
            if (findAndPatchHomePanel() || attempts++ >= 50) {
                clearInterval(timer);
            }
        }, 100);

        cleanups.push(() => clearInterval(timer));

        logger.log("[DM Collections] Loaded.");
    },

    onUnload() {
        for (const cleanup of cleanups.splice(0)) {
            try {
                cleanup();
            } catch {}
        }

        patched = false;

        logger.log("[DM Collections] Unloaded.");
    },
};
