#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.20251128.6195

using Vidyano.Core.Services;
using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithDefaultAdmin()
    .WithDefaultLanguage("en")
    .WithLanguage("en", new Dictionary<string, string>
    {
        ["en"] = "English",
        ["nl"] = "Engels",
        ["de"] = "Englisch"
    })
    .WithLanguage("nl", new Dictionary<string, string>
    {
        ["en"] = "Dutch",
        ["nl"] = "Nederlands",
        ["de"] = "Niederländisch"
    })
    .WithLanguage("de", new Dictionary<string, string>
    {
        ["en"] = "German",
        ["nl"] = "Duits",
        ["de"] = "Deutsch"
    })
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Attributes))
    .WithModel(builder =>
        {
            var po = builder.GetOrCreatePersistentObject(nameof(Mock_Attribute));

            var multilineAttr = po.GetOrCreateAttribute(nameof(Mock_Attribute.TranslatedStringMultiline));
            multilineAttr.DataTypeHints = "MultiLine=True";

            var readOnlyAttr = po.GetOrCreateAttribute(nameof(Mock_Attribute.TranslatedStringReadOnly));
            readOnlyAttr.IsReadOnly = true;
        })
    );

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Attribute> attributes = [];

    public MockContext()
    {
        Register(attributes);
    }

    public IQueryable<Mock_Attribute> Attributes => Query<Mock_Attribute>();

    public static Mock_Attribute GetOrCreateAttribute(string objectId)
    {
        var attribute = attributes.FirstOrDefault(a => a.Id == objectId);

        if (attribute == null)
            attributes.Add(attribute = new Mock_Attribute { Id = objectId });

        return attribute;
    }

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is Mock_Attribute attribute)
            attribute.Id ??= (attributes.Count + 1).ToString();

        base.AddObject(obj, entity);
    }
}

public class MockWeb: CustomApiController
{
    public override void GetWebsiteContent(WebsiteArgs args)
    {
        base.GetWebsiteContent(args);

        var frontEndUrl = ServiceLocator.GetService<IConfiguration>()["frontend:url"];
        if (!string.IsNullOrEmpty(frontEndUrl))
            args.Contents = args.Contents.Replace("https://unpkg.com/@vidyano/vidyano/index.min.js", frontEndUrl);
    }
}

public class Mock_AttributeActions(MockContext context) : PersistentObjectActions<MockContext, Mock_Attribute>(context)
{
    public override Mock_Attribute? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateAttribute(obj.ObjectId);
    }
}

public class Mock_Attribute
{
    public string Id { get; set; } = null!;

    public TranslatedString? TranslatedString { get; set; } = TranslatedString.FromJson(
        """
        {
            "en": "Hello",
            "nl": "Hallo",
            "de": "Guten Tag"
        }
        """);

    public TranslatedString? TranslatedStringMultiline { get; set; } = TranslatedString.FromJson(
        """
        {
            "en": "Line 1\nLine 2",
            "nl": "Regel 1\nRegel 2",
            "de": "Zeile 1\nZeile 2"
        }
        """);

    public TranslatedString? TranslatedStringReadOnly { get; set; } = TranslatedString.FromJson(
        """
        {
            "en": "Read Only",
            "nl": "Alleen lezen",
            "de": "Schreibgeschützt"
        }
        """);
}
