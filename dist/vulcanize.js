import fetch from 'node-fetch';
import fg from 'fast-glob';

// Ignore self-signed certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export default function vulcanize() {
    return {
        name: 'vulcanize',
        async load(id) {
            const index = id.indexOf("/web-components/");
            if (index >= 0) {
                id = id.substr("/workspaces/VidyanoWeb3/wwwroot/".length);
                const response = await fetch("https://localhost:5001/web3/" + id);
                return await response.text();
            }

            return null;
        },
        async transform(code, id) {
            if (id.endsWith("marked-element.js")) {
                code = code.replace("marked.Renderer", "marked.default.Renderer");
                code = code.replace("marked(this.markdown", "marked.default(this.markdown");
            }

            const index = id.indexOf("wwwroot/web-components/");
            if (index >= 0) {
                const idWithoutExtension = id.substring(0, id.lastIndexOf("."));

                const files = await fg([
                    idWithoutExtension + "*.css",
                    idWithoutExtension + "*.html"
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