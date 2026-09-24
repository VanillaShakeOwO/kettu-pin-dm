import { logger } from "@vendetta";
import {
    findByNameAll,
    findByDisplayNameAll,
} from "@vendetta/metro";
import { showSimpleActionSheet } from "@vendetta/ui/alerts";

export default {
    onLoad() {
        setTimeout(() => {
            try {
                const names = [
                    "AddFriends",
                    "AddFriend",
                    "HomePanelContent",
                    "PrivateChannels",
                ];

                const results: string[] = [];

                for (const name of names) {
                    const a = findByNameAll(name, true) ?? [];
                    const b = findByNameAll(name, false) ?? [];
                    const c = findByDisplayNameAll(name, true) ?? [];
                    const d = findByDisplayNameAll(name, false) ?? [];

                    results.push(`${name}: ${a.length + b.length + c.length + d.length}`);
                }

                logger.log("[DM Collections] Scan:", results);

                showSimpleActionSheet({
                    key: "DMCollectionsDiagnostic",
                    header: {
                        title: "DM Collections Scan",
                    },
                    options: results.map((result) => ({
                        label: result,
                        onPress: () => {},
                    })),
                });
            } catch (e) {
                logger.error("[DM Collections] Scan failed:", e);
            }
        }, 1000);
    },

    onUnload() {},
};
