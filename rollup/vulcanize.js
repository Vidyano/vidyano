import fg from 'fast-glob';
import * as path from "path";

import * as _fs from "fs";
const fs = _fs.promises;

async function replaceAsync(str, regex, asyncFn) {
    const promises = [];
    str.replace(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
}

const htmlLink = /<link.*?href=[\"'](.+?.html)[\"'].*?>/gm;
const cssLink = /<link.*?href=[\"'](.+?.css)[\"'].*?>/gm;
const cssReplaceHost = /:host([^{( >-][^{> ,]+?)([{> ,]|::before|::after)/gm;

export default function vulcanize() {
    return {
        name: 'vulcanize',
        async load(jsInput) {
            const index = jsInput.indexOf("web-components");
            if (index >= 0) {
                let js = (await fs.readFile(jsInput)).toString();

                return await replaceAsync(js, htmlLink, async (_, href) => {
                    const htmlInput = path.join(path.dirname(jsInput), href);
                    let html = (await fs.readFile(htmlInput)).toString().replace(/^\uFEFF/, '');

                    html = await replaceAsync(html, cssLink, async (_, href) => {
                        const cssInput = path.join(path.dirname(htmlInput), href);
                        let css = (await fs.readFile(cssInput)).toString().replace(/^\uFEFF/, '');

                        css = css.replace(cssReplaceHost, ":host($1)$2");
                        return `<style>${css}</style>`;
                    });

                    return html;
                });
            }

            return null;
        },
        async transform(code, id) {
            if (id.endsWith("marked-element.js")) {
                code = code.replace("marked.Renderer", "marked.default.Renderer");
                code = code.replace("marked(this.markdown", "marked.default(this.markdown");
            }

            const index = id.indexOf("web-components");
            if (index >= 0) {
                const componentDir = path.dirname(id);

                const files = await fg([
                    componentDir + "/*.css",
                    componentDir + "/*.html"
                ]);

                for (let file of files) {
                    this.addWatchFile(file);
                }
            }

            return {
                code: code,
                map: null
            };
        }
    };
}