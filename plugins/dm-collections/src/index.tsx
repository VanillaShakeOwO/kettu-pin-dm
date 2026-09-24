import { logger } from "@vendetta";
import { React } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { View, TouchableOpacity, Text } from "react-native";

const cleanups: (() => void)[] = [];
let patched = false;

function hasAddFriendsText(value: any): boolean {
    if (value == null) return false;

    if (typeof value === "string") {
        return value.toLowerCase().includes("add friends");
    }

    if (Array.isArray(value)) {
        return value.some(hasAddFriendsText);
    }

    if (React.isValidElement(value)) {
        return hasAddFriendsText(value.props?.children);
    }

    return false;
}

function isAddFriendsProps(props: any): boolean {
    if (!props || props.__dmCollectionsSkip) return false;

    const label = String(
        props.accessibilityLabel ??
        props.label ??
        "",
    ).toLowerCase();

    return (
        label.includes("add friends") ||
        (
            typeof props.onPress === "function" &&
            hasAddFriendsText(props.children)
        )
    );
}

function openTestMenu() {
    try {
        const show =
            findByProps("showSimpleActionSheet")?.showSimpleActionSheet;

        if (!show) {
            logger.log("[DM Collections] Action sheet API not found.");
            return;
        }

        show({
            key: "DMCollectionsTest",
            header: {
                title: "DM Collections",
            },
            options: [
                {
                    label: "Create Collection",
                    onPress: () => {
                        logger.log(
                            "[DM Collections] Create Collection pressed.",
                        );
                    },
                },
            ],
        });
    } catch (error) {
        logger.error("[DM Collections] Button press failed.", error);
    }
}

function CollectionPlusButton() {
    return (
        <TouchableOpacity
            onPress={openTestMenu}
            accessibilityLabel="DM Collections"
            accessibilityRole="button"
            style={{
                width: 44,
                height: 44,
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

function AddFriendsWithPlus(props: any) {
    const originalType = props.__dmCollectionsOriginalType;
    const originalProps = { ...props };

    delete originalProps.__dmCollectionsOriginalType;
    delete originalProps.__dmCollectionsSkip;

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
            }}
        >
            <CollectionPlusButton />

            {React.createElement(originalType, {
                ...originalProps,
                __dmCollectionsSkip: true,
            })}
        </View>
    );
}

function interceptElement(result: any, type: any, props: any): any {
    if (!result || !type || !isAddFriendsProps(props)) {
        return result;
    }

    result.type = AddFriendsWithPlus;
    result.props = {
        ...props,
        __dmCollectionsOriginalType: type,
    };

    return result;
}

function patchCreateElement() {
    if (patched) return;
    patched = true;

    cleanups.push(
        after(
            "createElement",
            React,
            (args: any[], result: any) =>
                interceptElement(result, args[0], args[1]),
        ),
    );

    const patchedRuntimes = new WeakSet<any>();

    function isJsxRuntime(value: any): boolean {
        return (
            typeof value?.jsx === "function" ||
            typeof value?.jsxs === "function" ||
            typeof value?.jsxDEV === "function"
        );
    }

    function patchRuntime(runtime: any) {
        if (!runtime || patchedRuntimes.has(runtime)) return;
        if (!isJsxRuntime(runtime)) return;

        patchedRuntimes.add(runtime);

        for (const key of ["jsx", "jsxs", "jsxDEV"] as const) {
            if (typeof runtime[key] !== "function") continue;

            cleanups.push(
                after(
                    key,
                    runtime,
                    (args: any[], result: any) =>
                        interceptElement(result, args[0], args[1]),
                ),
            );
        }
    }

    function scan() {
        try {
            const modules = (globalThis as any)?.modules;
            if (!modules) return;

            for (const id in modules) {
                const def = modules[id];
                if (!def?.isInitialized) continue;

                const exports = def.publicModule?.exports;
                if (!exports) continue;

                if (isJsxRuntime(exports)) patchRuntime(exports);
                if (isJsxRuntime(exports.default)) {
                    patchRuntime(exports.default);
                }
            }
        } catch {
            // Keep scanning silently.
        }
    }

    scan();

    const timer = setInterval(scan, 500);
    cleanups.push(() => clearInterval(timer));

    logger.log("[DM Collections] UI test patch loaded.");
}

export default {
    onLoad() {
        try {
            patchCreateElement();
            logger.log("[DM Collections] Loaded successfully.");
        } catch (error) {
            logger.error("[DM Collections] Failed to load.", error);
        }
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
