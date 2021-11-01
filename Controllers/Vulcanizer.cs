using System.IO;
using System.Text.RegularExpressions;

namespace VidyanoWeb3.Controllers {
    public static class Vulcanizer
    {
        public static string RootPath = Path.Combine(Program.HostEnvironment.ContentRootPath, "wwwroot");
        private static readonly Regex cssLinkRe = new Regex("<link.*?href=[\"'](.+?.css)[\"'].*?>");
        private static readonly Regex htmlLinkRe = new Regex("<link.*?href=[\"'](.+?.html)[\"'].*?>");
        private static readonly Regex importRe = new Regex("(import\\s+?(?:(?:(?:[\\w*\\s{},]*)\\s+from\\s+?)|))((?:(?:\".*?\")|(?:'.*?')))([\\s]*?(?:;|$|))");

        public static string Generate(string file)
        {
            var directory = Path.GetDirectoryName(file);
            if (!string.IsNullOrEmpty(directory))
                directory = directory.Replace('\\', '/') + "/";

            var js = File.ReadAllText(file);
            js = htmlLinkRe.Replace(js, htmlMatch =>
            {
                var html = File.ReadAllText(Path.Combine(RootPath, directory + htmlMatch.Groups[1].Value));
                html = cssLinkRe.Replace(html, cssMatch =>
                {
                    return "<style>" + FixCss(File.ReadAllText(Path.Combine(RootPath, directory + cssMatch.Groups[1].Value))) + "</style>";
                });

                return html;
            });

            var relativeTo = Path.GetFullPath(Path.GetDirectoryName(file));
            return importRe.Replace(js, match =>
            {
                var import = match.Groups[2].Value.Substring(1, match.Groups[2].Value.Length - 2);
                return import != null ? match.Groups[1].Value + $"'{import}'" + match.Groups[3].Value : string.Empty;
            });
        }

        private static string FixCss(string css)
        {
            // Fix :host(...) with parent selectors
            css = Regex.Replace(css, ":host([^{( >-][^{> ,]+)([{> ,])", ":host($1)$2");

            // Transform --at-apply: to @apply
            // More info: https://www.xanthir.com/b4o00, to be replaced with: https://www.w3.org/TR/css-shadow-parts-1/
            css = Regex.Replace(css, "--at-apply:([^;}]+)", "@apply($1)");

            return css;
        }
    }
}