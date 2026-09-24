import { logger } from "@vendetta";

export default {
    onLoad() {
        logger.log("[DM Collections] TEST LOAD OK");
    },

    onUnload() {
        logger.log("[DM Collections] TEST UNLOAD");
    },
};
