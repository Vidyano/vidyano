using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseWebRoot("wwwroot");

var app = builder.Build();

app.MapGet("web3/{**id}", (string id) => {
    var provider = new FileExtensionContentTypeProvider();
    if (!provider.TryGetContentType(id, out var mimeType))
    {
        switch (Path.GetExtension(id))
        {
            case ".mjs":
                mimeType = "application/javascript";
                break;

            default:
                mimeType = "application/octet-stream";
                break;
        }
    }

    var filePath = Path.Combine(Vulcanizer.RootPath, id);
    if (!System.IO.File.Exists(filePath))
        return Results.NotFound();

    // TODO: Verify if file is allow to be served
    return Results.Content(Vulcanizer.Generate(filePath), mimeType);
});

app.UseStaticFiles();

app.MapFallback(() => {
    return Results.Content(File.ReadAllText("wwwroot/index.html"), "text/html; charset=utf-8");
});

app.Run();