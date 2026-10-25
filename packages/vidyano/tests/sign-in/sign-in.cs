#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@7.0.20260922.6581-rc.1

using Vidyano.Service;

var builder = WebApplication.CreateBuilder(args);

// Passkeys are off by default; the in-memory passkey store keeps them for the life of the process
builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithDefaultAdmin()
    .WithConfig("Passkeys:Enabled", "true")
);

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
}
