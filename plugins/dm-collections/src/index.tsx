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
                    const byName = findByNameAll(name, true) ?? [];
                    const byDefaultName = findByNameAll(name, false) ?? [];
                    const byDisplay = findByDisplayNameAll(name, true) ?? [];
                    const byDefaultDisplay = findByDisplayNameAll(name, false) ?? [];

                    const count =
                        byName.length +
                        byDefaultName.length +
                        byDisplay.length +
                        byDefaultDisplay.length;

                    results.push(`${name}: ${count}`);
                }

                logger.log("[DM Collections] Module scan:", results);

                showSimpleActionSheet({
                    key: "DMCollectionsDiagnostic",
                    header: {
                        title: "DM Collections Diagnostic",
                    },
                    options: results.map((result) => ({
                        label: result,
                        onPress: () => {},
                    })),
                });
            } catch (e) {
                logger.error("[DM Collections] Diagnostic failed:", e);
            }
        }, 1000);
    },

    onUnload() {},
};
