import { readFile, writeFile, readdir } from "fs/promises";
import { extname } from "path";
import { createHash } from "crypto";

import { rollup } from "rollup";
import esbuild from "rollup-plugin-esbuild";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import swc from "@swc/core";

const extensions = [".js", ".jsx", ".mjs", ".ts", ".tsx", ".cts", ".mts"];

/** @type import("rollup").InputPluginOption */
const plugins = [
    nodeResolve(),
    commonjs(),
    {
        name: "swc",
        async transform(code, id) {
            const ext = extname(id);

            if (!extensions.includes(ext)) {
                return null;
            }

            const isTypeScript = [".ts", ".tsx", ".cts", ".mts"].includes(ext);
            const isTSX = [".tsx"].includes(ext);
            const isJSX = [".jsx"].includes(ext);

            const result = await swc.transform(code, {
                filename: id,
                jsc: {
                    externalHelpers: true,
                    parser: {
                        syntax: isTypeScript ? "typescript" : "ecmascript",
                        tsx: isTSX,
                        jsx: isJSX,
                    },
                },
                env: {
                    targets: "defaults",
                    include: [
                        "transform-classes",
                        "transform-arrow-functions",
                    ],
                },
            });

            return {
                code: result.code,
                map: result.map,
            };
        },
    },
    esbuild({
        minify: true,
    }),
];

const pluginFolders = await readdir("./plugins");

for (const plugin of pluginFolders) {
    const pluginPath = `./plugins/${plugin}`;
    const manifestPath = `${pluginPath}/manifest.json`;

    try {
        const manifest = JSON.parse(
            await readFile(manifestPath, "utf8")
        );

        if (!manifest.main) {
            throw new Error(
                `manifest.json for ${plugin} is missing the "main" field.`
            );
        }

        const inputPath = `${pluginPath}/${manifest.main}`;
        const outputDirectory = `./dist/${plugin}`;
        const outPath = `${outputDirectory}/index.js`;

        console.log(`Building ${manifest.name || plugin}...`);
        console.log(`Entry: ${inputPath}`);

        const bundle = await rollup({
            input: inputPath,
            onwarn: () => {},
            plugins,
        });

        await bundle.write({
            file: outPath,
            globals(id) {
                if (id.startsWith("@vendetta")) {
                    return id.substring(1).replace(/\//g, ".");
                }

                const globals = {
                    react: "window.React",
                };

                return globals[id] || null;
            },
            format: "iife",
            compact: true,
            exports: "named",
        });

        await bundle.close();

        const builtPlugin = await readFile(outPath);

        manifest.hash = createHash("sha256")
            .update(builtPlugin)
            .digest("hex");

        manifest.main = "index.js";

        await writeFile(
            `${outputDirectory}/manifest.json`,
            JSON.stringify(manifest, null, 2)
        );

        console.log(`Successfully built ${manifest.name || plugin}!`);
    } catch (error) {
        console.error(`Failed to build plugin "${plugin}"...`);
        console.error(error);
        process.exit(1);
    }
}
