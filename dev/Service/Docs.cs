using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Vidyano.Service;

namespace Dev.Service;

/// <summary>
/// The "Docs" website (http://docs.localhost:5000/): documentation with live examples. Every path gets the same
/// page, wwwroot/docs.js; each wwwroot/docs/&lt;name&gt;.js is one documentation page, at /&lt;name&gt;/, and each
/// wwwroot/docs/&lt;name&gt;/&lt;sub&gt;.js a page under it, at /&lt;name&gt;/&lt;sub&gt;/. Files starting with _ are shared
/// code, not pages.
/// </summary>
public static class Docs
{
    public const string WebsiteName = "Docs";

    /// <summary>Where docs.js loads highlight.js and its theme from: only this package, not all of jsdelivr.</summary>
    public const string Cdn = "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/";

    public static void Serve(WebsiteArgs args)
    {
        var folder = Path.Combine(args.Request.HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().WebRootPath, "docs");
        var pages = Directory.Exists(folder)
            ? Directory.GetFiles(folder, "*.js", SearchOption.AllDirectories)
                .Select(file => Path.GetRelativePath(folder, file).Replace('\\', '/')[..^3])
                .Where(name => name.Split('/').Length <= 2 && !name.Split('/').Any(part => part.StartsWith('_')))
                .Order()
                .ToArray()
            : [];

        // The page finds the page modules through this list; the attribute is single-quoted
        args.Contents = args.Contents.Replace("{pages}", JsonSerializer.Serialize(pages).Replace("'", "&#39;"));
    }
}
